import Redis from "ioredis";
import Queue from "bull";
import dotenv from "dotenv";
import { EventData, Matchup } from "../../interfaces/matchup.ts";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import logger from "../../winstonLogger.ts";
import { getOddsQueueDelay } from "../../utils/oddsQueueUtils.ts";
import { leagueLookup } from "../../utils/leagueMap.ts";
import moment from "moment";
import "moment-timezone";
import { handleNetworkError } from "../../utils/matchupFinderUtils.ts";
import {
  gameTimeInPast,
  getMsToGameTime,
  getScoresAsNums,
} from "../../utils/liveScoreQueueUtils.ts";

dotenv.config({ path: "../../.env" });

const queue = new Queue("liveScore", process.env.REDIS_HOST!);
const redis = new Redis(process.env.REDIS_HOST!);
const prisma = new PrismaClient();

const location = "liveScoreConsumer";

/**
 * - Determine time until game start and create a delay to approx that time so as to lock it
 * - fetch game and confirmed is "used" and start time makes sense
 * - mark game as locked and make it IP status
 * - call live score endpoint with league ID
 * - call event by ID endpoint as a confirmation/backup if liveScore returns strange stuff
 * - if game is finished mark as unlocked, FT status, and record scores
 * - maybe create some sort of "event" to push to clients somehow when game ends
 * - else re-add it to queue with delay down to every 3 minutes
 */

async function getCachedResponse(endpointCacheKey: string, expirationTimeInSeconds: number) {
  const cached = await redis.get(endpointCacheKey);
  if (cached) {
    logger.info({ message: "returned from cache!" });
    return JSON.parse(cached);
  }

  const { data } = await axios.get(`${process.env.LINES_BASE_URL}/${endpointCacheKey}`);
  redis.set(endpointCacheKey, JSON.stringify(data), "EX", expirationTimeInSeconds); // cache for 30 minutes

  return data;
}

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
      prisma.matchups.update({
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

  // TODO update this for liveScore queue
  const delayToNextUpdate = getOddsQueueDelay(matchup.strTimestamp);

  // TODO update this
  if (!delayToNextUpdate) {
    logger.info({
      message: "moving matchup to liveScore queue",
      location,
      matchupId: id,
    });
    job.finished();
    return id;
  }

  const {
    oddsType,
    idEvent,
    idLeague,
    strTimestamp,
    strAwayTeam,
    strHomeTeam,
    drawEligible,
    drawTeam,
  } = matchup;

  const league = leagueLookup[idLeague];
  const date = moment.utc(strTimestamp).tz("America/Los_Angeles").format("YYYY-MM-DD");

  let eventResponse;

  try {
    const eventEndpointCacheKey = `${process.env.SPORTS_BASE_URL}/lookupevent.php?id=${idEvent}`;
    eventResponse = await getCachedResponse(eventEndpointCacheKey, 60 * 3);
  } catch (error) {
    handleNetworkError(error);
    throw new Error("LiveScore API request failed");
  }

  const event: EventData | null = eventResponse.events;

  if (!event) {
    const message = "No matching event in response";
    logger.error({
      message,
      location,
      anomalyData: { matchupId: id, idEvent, idLeague },
    });
    throw new Error(message);
  }

  const { intHomeScore, intAwayScore, strStatus } = event;

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
    const scoreTotal = homeScore + awayScore;
    const isDraw = awayScore === homeScore;

    let result: string;

    if (oddsType === "money-line") {
      // TODO
    } else if (oddsType === "pointspread") {
      // TODO
    } else if (oddsType === "totals") {
      // TODO
    } else {
      throw new Error("invalid oddsType found");
    }

    // update scores, totals and mark as unlocked on Matchup
    // function to take in scores and determine winner and mark as win/loss for users
  }

  job.finished();
  return id;
});

// TODO update all of these for liveScore queue
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
