import Redis from "ioredis";
import Queue from "bull";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { MatchupWithOdds } from "../../interfaces/queue";
import { GameRows, GameView, Odds, OddsView } from "../../interfaces/matchup";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import logger from "../../winstonLogger.ts";
import { getOddsQueueDelay, oddsWereUpdated } from "../../utils/oddsQueueUtils.ts";
import { leagueLookup } from "../../utils/leagueMap.ts";
import moment from "moment";
import "moment-timezone";
import { mandatoryOddsFields } from "../../utils/matchupBuilderUtils.ts";
import { handleNetworkError } from "../../utils/matchupFinderUtils.ts";

dotenv.config({ path: "../../.env" });

const queue = new Queue("oddsQueue", process.env.REDIS_HOST!);
const liveScoreQueue = new Queue("liveScore", process.env.REDIS_HOST!);
const redis = new Redis(process.env.REDIS_HOST!);
const prisma = new PrismaClient();

async function getCachedOdds(endpointCacheKey: string) {
  const cached = await redis.get(endpointCacheKey);
  if (cached) {
    logger.info({ message: "odds returned from cache!", cacheKey: endpointCacheKey });
    return JSON.parse(cached);
  }

  const { data } = await axios.get(`${process.env.LINES_BASE_URL}/${endpointCacheKey}`);
  redis.set(endpointCacheKey, JSON.stringify(data), "EX", 60 * 30); // cache for 30 minutes

  return data;
}

// TODO fix any type
queue.process(async (job: any) => {
  logger.info({ message: "odds queue processing", data: job.data });

  const { id } = job.data;

  // @ts-ignore
  const matchupWithOdds: MatchupWithOdds | null = await prisma.matchups.findUnique({
    where: {
      id,
      used: true,
    },
    include: {
      Odds: {
        orderBy: {
          lastUpdate: "desc",
        },
      },
    },
  });

  if (!matchupWithOdds?.strTimestamp) throw new Error("matchup not found in db");

  const delayToNextUpdate = getOddsQueueDelay(matchupWithOdds.strTimestamp);

  if (!delayToNextUpdate) {
    await liveScoreQueue.add(
      { id, msDelay: 0 },
      {
        delay: 0,
        attempts: 3,
        removeOnComplete: {
          age: 604800, // keep up to 1 week (in seconds)
          count: 1000, // keep up to 1000 jobs
        },
        backoff: {
          type: "fixed",
          delay: 180000, // 3 minutes
        },
      }
    );
    logger.info({
      message: "moving matchup to liveScore queue",
      location: "oddsConsumer",
      matchupId: id,
    });
    job.finished();
    return id;
  }

  const { oddsType, oddsScope, idLeague, strTimestamp, strAwayTeam, strHomeTeam, Odds } =
    matchupWithOdds;

  const league = leagueLookup[idLeague];
  const date = moment.utc(strTimestamp).tz("America/Los_Angeles").format("YYYY-MM-DD");

  let response;

  try {
    const endpointCacheKey = `${league}/${oddsType}/${oddsScope}.json?date=${date}`;
    response = await getCachedOdds(endpointCacheKey);
  } catch (error) {
    handleNetworkError(error);
    throw new Error("Odds API request failed");
  }
  const gameData = response?.pageProps?.oddsTables?.[0]?.oddsTableModel?.gameRows ?? null;

  const gameRows: GameRows[] | null =
    gameData?.map(({ gameView, oddsViews }: { gameView: GameView; oddsViews: OddsView[] }) => ({
      gameView,
      oddsViews,
    })) ?? null;

  if (!gameRows?.length) {
    const message = "gameRows not found during odds update attempt";
    logger.warn({
      message,
      anomalyData: { id, oddsType, league, oddsScope },
    });
    throw new Error(message);
  }

  const gameRow = gameRows.find(
    game =>
      game.gameView.awayTeam.fullName === strAwayTeam &&
      game.gameView.homeTeam.fullName === strHomeTeam
  );

  if (!gameRow) {
    const message = "No team match in game row";
    logger.error({
      message,
      anomalyData: { matchupId: id, league, oddsType },
    });
    throw new Error(message);
  }

  const { gameView, oddsViews } = gameRow;

  if (!gameView || !oddsViews) {
    const message = "missing game view or odds view";
    logger.error({
      message,
      anomalyData: { matchupId: id, league },
    });
    throw new Error(message);
  }

  const latestDbOdds = Odds[0];
  const gameOdds = oddsViews.find(
    (oddsView: OddsView | null) => oddsView?.sportsbook === Odds[0].sportsbook
  );

  if (!gameOdds?.currentLine) {
    const message = "no updated odds from same sportsbook found";
    logger.error({
      message,
      anomalyData: { matchupId: id, sportsbook: Odds[0].sportsbook, league, oddsType },
    });
    throw new Error(message);
  }

  const { homeOdds, awayOdds, drawOdds, overOdds, underOdds, homeSpread, awaySpread, total } =
    gameOdds.currentLine;

  const oddsChanged = oddsWereUpdated(
    mandatoryOddsFields,
    oddsType,
    gameOdds.currentLine,
    latestDbOdds
  );

  if (oddsChanged) {
    const odds: Odds = {
      id: uuidv4(),
      matchupId: id,
      oddsGameId: gameOdds.gameId,
      sportsbook: gameOdds.sportsbook,
      homeOdds,
      awayOdds,
      drawOdds,
      overOdds,
      underOdds,
      homeSpread,
      awaySpread,
      total,
      lastUpdate: moment.utc().toISOString(),
    };

    logger.info({
      previousOdds: latestDbOdds,
      newOdds: odds,
      debug: true,
    });

    const updatedOdds = await prisma.odds.create({ data: odds });

    if (updatedOdds) {
      logger.info({
        message: "odds updated successfully",
        location: "oddsConsumer",
        oddsId: updatedOdds.id,
        matchupId: id,
      });
    }
  }

  await queue.add({ id, msDelay: delayToNextUpdate }, { delay: delayToNextUpdate });
  logger.info({
    message: "adding matchup back to oddsQueue for next update",
    location: "oddsConsumer",
    matchupId: id,
  });

  job.finished();
  return id;
});

queue.on("completed", (_, result) => {
  logger.info({ message: "oddsQueue job completed", matchupId: result });
});

queue.on("error", (err: Error) => {
  logger.error({ message: "Error in oddsQueue", err });
});

queue.on("failed", (job, error) => {
  logger.error({ message: "Job failed in oddsQueue", jobId: job.id, error: error.message });
});

setInterval(() => console.log("Consumer alive!"), 60000);

process.on("uncaughtException", function (err) {
  logger.error({ err, message: "Uncaught exception" });
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ promise, reason, message: "Unhandled Rejection at: Promise" });
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  await queue.close();
});
