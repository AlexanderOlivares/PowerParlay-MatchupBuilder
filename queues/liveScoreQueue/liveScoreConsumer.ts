import Redis from "ioredis";
import Queue from "bull";
import dotenv from "dotenv";
import { EventData, Matchup } from "../../interfaces/matchup.ts";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import logger from "../../winstonLogger.ts";
import { leagueLookup } from "../../utils/leagueMap.ts";
import "moment-timezone";
import { handleNetworkError } from "../../utils/matchupFinderUtils.ts";
import {
  gameTimeInPast,
  getLiveScoreQueueDelay,
  getMsToGameTime,
  getScoresAsNums,
} from "../../utils/liveScoreQueueUtils.ts";

dotenv.config({ path: "../../.env" });

const queue = new Queue("liveScore", process.env.REDIS_HOST!);
const prisma = new PrismaClient();

const location = "liveScoreConsumer";

// TODO fix any type
queue.process(async (job: any) => {
  logger.info({ message: "liveScore queue processing", data: job.data });

  const { id } = job.data;

  // @ts-ignore
  const matchup: Matchup | null = await prisma.matchups.findUnique({
    where: {
      id,
      used: true,
    },
  });

  if (!matchup) {
    throw new Error("matchup not found in db");
  }

  if (!matchup.locked) {
    const gameStarted = gameTimeInPast(matchup.strTimestamp);
    if (gameStarted) {
      await prisma.matchups.update({
        where: { id },
        data: {
          locked: true,
          status: "IP",
        },
      });
      logger.info({
        message: "Matchup updated to locked and IP",
        location,
        matchupId: id,
      });
    } else {
      const delay = getMsToGameTime(matchup.strTimestamp);
      await queue.add({ id, delayToGameTime: delay }, { delay });
      logger.info({
        message: "GameTime in future. Adding back to liveScoreQueue",
        location,
        matchupId: id,
      });
      job.finished();
      return id;
    }
  }

  const { idEvent, idLeague } = matchup;

  const league = leagueLookup[idLeague];

  let eventResponse;

  try {
    const { data } = await axios.get(
      `${process.env.SPORTS_BASE_URL}/lookupevent.php?id=${idEvent}`
    );
    eventResponse = data;
  } catch (error) {
    handleNetworkError(error);
    throw new Error("LiveScore API request failed");
  }

  const event: EventData[] | string | null = eventResponse.events;

  if (!Array.isArray(event)) {
    const message = "Error in event response";
    logger.error({
      message,
      location,
      anomalyData: { matchupId: id, idEvent, idLeague },
    });
    throw new Error(message);
  }

  const { intHomeScore, intAwayScore, strStatus } = event[0];

  if ([intHomeScore, intAwayScore, strStatus].some(field => !field)) {
    const message = "missing mandatory field in event response";
    logger.error({
      message,
      location,
      anomalyData: { matchupId: id, league },
    });
    throw new Error(message);
  }

  if (strStatus === "FT") {
    // @ts-ignore already checking for falsy fields in .some func above
    const { awayScore, homeScore } = getScoresAsNums(intAwayScore, intHomeScore);
    const pointsTotal = homeScore + awayScore;

    const completedMatchup = await prisma.matchups.update({
      where: {
        id,
      },
      data: {
        status: "FT",
        locked: false,
        awayScore,
        homeScore,
        pointsTotal,
      },
    });

    logger.info({
      location,
      message: "Matchup has ended",
      matchupId: id,
      awayScore: completedMatchup.awayScore,
      homeScore: completedMatchup.homeScore,
      pointsTotal: completedMatchup.pointsTotal,
    });
  } else {
    const delay = getLiveScoreQueueDelay(matchup.strTimestamp);
    await queue.add(
      { id, delay },
      {
        delay,
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
      message: "Game is IP. Adding back to liveScoreQueue for next update",
      delay,
      location,
      matchupId: id,
    });
  }

  job.finished();
  return id;
});

// TODO update all of these for liveScore queue
queue.on("completed", (_, result) => {
  logger.info({ message: "liveScoreQueue job completed", matchupId: result });
});

queue.on("error", (err: Error) => {
  logger.error({ message: "Error in liveScoreQueue", err });
});

queue.on("failed", (job, error) => {
  logger.error({ message: "Job failed in liveScoreQueue", jobId: job.id, error: error.message });
});

setInterval(() => console.log("liveScoreConsumer alive!"), 60000);

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
