import Queue from "bull";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { Job, MatchupWithOdds } from "../../interfaces/queue";
import { GameRows, GameView, Odds, OddsView } from "../../interfaces/matchup";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import logger from "../../winstonLogger.ts";
import { getOddsQueueDelay } from "../../utils/oddsQueueUtils.ts";
import { leagueLookup } from "../../utils/leagueMap.ts";
import moment from "moment";
import { mandatoryOddsFields } from "../../utils/matchupBuilderUtils.ts";
import { handleNetworkError } from "../../utils/matchupFinderUtils.ts";

dotenv.config({ path: "../../.env" });

const queue = new Queue("oddsQueue", process.env.REDIS_HOST!);
const prisma = new PrismaClient();

// TODO fix any type
queue.process(async (job: any) => {
  logger.info({ message: "odds queue test", data: job.data });

  const { id } = job.data;

  if (job.attemptsMade > 2) {
    logger.error({
      message: "killing odds job after 2 failed attempts",
      id,
      location: "oddsConsumer",
    });
    await job.remove();
    return;
  }

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

  if (!matchupWithOdds?.strTimestamp) {
    logger.error({ message: "matchup not found in db", location: "oddsQueue" });
    return;
  }

  const delayToNextUpdate = getOddsQueueDelay(matchupWithOdds.strTimestamp);
  // const RETRY_DELAY = 3600000; // 1 hour in ms
  const RETRY_DELAY = 30000; // 30 sec for testing

  const { oddsType, oddsScope, strLeague, strTimestamp, strAwayTeam, strHomeTeam, Odds } =
    matchupWithOdds;

  const league = leagueLookup[strLeague];
  const date = moment(strTimestamp).format("YYYY-MM-DD");

  // TODO check if response in cache here

  let response;

  try {
    const { data } = await axios.get(
      `${process.env.LINES_BASE_URL}/${league}/${oddsType}/${oddsScope}.json?date=${date}`
    );
    response = data;
  } catch (error) {
    handleNetworkError(error);
    job.retry({ delay: RETRY_DELAY });
    return;
  }
  const gameData = response?.pageProps?.oddsTables?.[0]?.oddsTableModel?.gameRows ?? null;

  const gameRows: GameRows[] | null =
    gameData?.map(({ gameView, oddsViews }: { gameView: GameView; oddsViews: OddsView[] }) => ({
      gameView,
      oddsViews,
    })) ?? null;

  if (!gameRows?.length) {
    logger.warn({
      message: "gameRows not found during odds update attempt",
      anomalyData: { id, oddsType, league, oddsScope },
    });
    job.retry({ delay: RETRY_DELAY });
    return;
  }

  const gameRow = gameRows.find(game => {
    game.gameView.awayTeam.fullName === strAwayTeam &&
      game.gameView.homeTeam.fullName === strHomeTeam;
  });

  if (!gameRow) {
    logger.error({
      message: "No team match in game row",
      anomalyData: { matchupId: id, league, oddsType },
    });
    job.retry({ delay: RETRY_DELAY });
    return;
  }

  const { gameView, oddsViews } = gameRow;

  if (!gameView || !oddsViews) {
    logger.error({
      message: "missing game view or odds view",
      anomalyData: { matchupId: id, league },
    });
    job.retry({ delay: RETRY_DELAY });
    return;
  }

  const latestDbOdds = Odds[0];
  const gameOdds = oddsViews.find(oddsView => oddsView.sportsbook === Odds[0].sportsbook);

  if (!gameOdds?.currentLine) {
    logger.error({
      message: "no updated odds from same sportsbook found",
      anomalyData: { matchupId: id, sportsbook: Odds[0].sportsbook, league, oddsType },
    });
    job.retry({ delay: RETRY_DELAY });
    return;
  }

  const { homeOdds, awayOdds, drawOdds, overOdds, underOdds, homeSpread, awaySpread, total } =
    gameOdds.currentLine;

  const oddsChanged = mandatoryOddsFields[oddsType].some(
    odds => gameOdds.currentLine[odds] !== latestDbOdds[odds]
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

  if (delayToNextUpdate) {
    await queue.add({ id, msDelay: delayToNextUpdate }, { delay: delayToNextUpdate });
    logger.info({
      message: "adding matchup back to oddsQueue for next update",
      location: "oddsConsumer",
      matchupId: id,
    });
  } else {
    logger.info({
      message: "moving matchup to liveScore queue",
      location: "oddsConsumer",
      matchupId: id,
    });
    // TODO add to liveScore queue
  }
  job.finish();
});

queue.on("completed", (job: Job) => {
  logger.info({ message: "Completed job in oddsQueue", jobId: job.id });
});

queue.on("error", (err: Error) => {
  logger.error({ message: "Queue error", err });
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
