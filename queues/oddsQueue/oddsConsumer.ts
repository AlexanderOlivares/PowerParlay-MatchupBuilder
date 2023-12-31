import Redis from "ioredis";
import Queue, { Job } from "bull";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { MatchupWithOdds } from "../../interfaces/queue";
import { GameRows, GameView, Odds, OddsView, SelectedPick } from "../../interfaces/matchup";
import { PrismaClient } from "@prisma/client";
import logger from "../../winstonLogger.ts";
import {
  getCachedOdds,
  getOddsQueueDelay,
  getOddsScopes,
  oddsWereUpdated,
} from "../../utils/oddsQueueUtils.ts";
import { leagueLookup } from "../../utils/leagueMap.ts";
import moment from "moment";
import "moment-timezone";
import { mandatoryOddsFields, matchGameRowByTeamNames } from "../../utils/matchupBuilderUtils.ts";
import { handleNetworkError } from "../../utils/matchupFinderUtils.ts";

dotenv.config({ path: "../../.env" });

const queue = new Queue("oddsQueue", process.env.REDIS_HOST!);
const liveScoreQueue = new Queue("liveScore", process.env.REDIS_HOST!);
const redis = new Redis(process.env.REDIS_HOST!);
const prisma = new PrismaClient();

const location = "oddsConsumer";

queue.process(async (job: Job) => {
  logger.info({ message: "odds queue processing", data: job.data });

  const { id } = job.data;

  // @ts-ignore
  const matchupWithOdds: MatchupWithOdds | null = await prisma.matchups.findUnique({
    where: {
      id,
      used: true,
    },
    include: {
      odds: {
        orderBy: {
          createdAt: "desc",
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

  const { oddsType, oddsScope, idLeague, strTimestamp, strAwayTeam, strHomeTeam, odds } =
    matchupWithOdds;

  const league = leagueLookup[idLeague];
  const date = moment.utc(strTimestamp).tz("America/Los_Angeles").format("YYYY-MM-DD");

  let response;

  try {
    const scopes = getOddsScopes(oddsType, idLeague);
    const endpointCacheKey = `${league}${scopes}.json?date=${date}`;
    response = await getCachedOdds(redis, endpointCacheKey, location);
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

  const gameRow = matchGameRowByTeamNames(gameRows, strAwayTeam, strHomeTeam);

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

  const latestDbOdds = odds[0];
  const gameOdds = oddsViews.find(
    (oddsView: OddsView | null) => oddsView?.sportsbook === odds[0].sportsbook
  );

  if (!gameOdds?.currentLine) {
    const message = "no updated odds from same sportsbook found";
    logger.error({
      message,
      anomalyData: { matchupId: id, sportsbook: odds[0].sportsbook, league, oddsType },
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
    const oddsId = uuidv4();
    const odds: Odds = {
      id: oddsId,
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
    };

    logger.info({
      previousOdds: latestDbOdds,
      newOdds: odds,
      debug: true,
    });

    const updatedOdds = await prisma.$transaction(async tx => {
      const newOdds: Odds = await tx.odds.create({ data: odds });
      const picksIdsToUpdate: Pick<SelectedPick, "id">[] = await tx.pick.findMany({
        where: { matchupId: id, useLatestOdds: true },
        select: { id: true },
      });
      const pickUpdatePromises = picksIdsToUpdate.map(
        async ({ id }) => await tx.pick.update({ where: { id }, data: { oddsId } })
      );
      await Promise.all(pickUpdatePromises);
      return newOdds;
    });

    if (updatedOdds) {
      logger.info({
        message: "odds updated successfully",
        location: "oddsConsumer",
        oddsId: updatedOdds.id,
        matchupId: id,
      });
    }
  }

  await queue.add(
    { id, msDelay: delayToNextUpdate },
    {
      delay: delayToNextUpdate,
      attempts: 3,
      removeOnComplete: {
        age: 604800, // keep up to 1 week (in seconds)
        count: 1000, // keep up to 1000 jobs
      },
      backoff: {
        type: "fixed",
        delay: 1800000, // 30 minutes
      },
    }
  );
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

queue.on("failed", async (job, error) => {
  const wasDeleted = await redis.del("token");
  logger.error({
    message: "Job failed in oddsQueue",
    tokenDeletedFromCache: Boolean(wasDeleted),
    jobId: job.id,
    matchupId: job?.data?.id,
    error: error.message,
  });
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
