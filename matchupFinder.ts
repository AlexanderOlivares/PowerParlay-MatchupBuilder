import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import moment from "moment";
import "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import logger from "./winstonLogger";

dotenv.config();

const prisma = new PrismaClient();

const BASE_URL = process.env.BASE_URL;
const TZ = process.env.TZ;
const WORKFLOW_DAY_OFFSET = process.env.DAY_OFFSET;
const WORKFLOW_START_DATE = process.env.START_DATE;

const MLB = process.env.MLB as string;
const MLS = process.env.MLS as string;

export function getWorkflowStartDate(dateString?: string) {
  if (!dateString) return moment();
  return moment(dateString);
}

export function getWorkflowDayOffset(numberAsString?: string) {
  const SUNDAY_CRON_OFFSET = 2;
  if (!numberAsString) return SUNDAY_CRON_OFFSET;
  return Number(numberAsString) ?? SUNDAY_CRON_OFFSET;
}

/*
This script is designed to run on Sun to capture games for the upcoming Tue - Mon. 
Optional params can be manually added in the github workflow_dispatch inputs
*/
export function getUpcomingWeekDates(
  startDate: moment.Moment = getWorkflowStartDate(WORKFLOW_START_DATE),
  dayOffset: number = getWorkflowDayOffset(WORKFLOW_DAY_OFFSET)
) {
  const WEEK_LENGTH = 7;
  return Array.from({ length: WEEK_LENGTH }, (_, i) => {
    return moment(startDate)
      .tz("America/Los_Angeles")
      .add(i + dayOffset, "days")
      .format("YYYYMMDD");
  });
}

export function promiseDotAll(dates: string[], sport: string) {
  return dates.map(async date => {
    try {
      const { data } = await axios.get(`${BASE_URL}${sport}?dates=${date}&tz=${TZ}`);
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          logger.error({ message: axiosError.response });
        } else if (axiosError.request) {
          logger.error({ message: axiosError.request });
        } else {
          logger.error({ message: axiosError });
        }
      } else if (error instanceof Error) {
        logger.error({ message: error.message });
      } else {
        logger.error({ unknownError: true, message: error });
      }
      logger.warn({ message: "Error caught and returned { error: true }" });
      return { error: true };
    }
  });
}

const upcomingWeekDates = getUpcomingWeekDates();

const buildSportRequests = [MLB, MLS].flatMap(sport => {
  return promiseDotAll(upcomingWeekDates, sport);
});

const sportsData = await Promise.all(buildSportRequests);

// TODO update with other soccer leagues
function isDrawEligible(league: string) {
  return ["MLS"].includes(league);
}

interface IPotentialMatchup {
  id: string;
  eventId: string;
  gameDate: string;
  gameTime: string;
  name: string;
  league: string;
  gameStatus: string;
  drawEligible: boolean;
}

const formattedMatchups: IPotentialMatchup[] = [];

for (const sport of sportsData) {
  if (sport.error) continue;

  const league = sport?.leagues?.[0].abbreviation ?? "";
  const events = sport?.events ?? [];
  if (!league || !events.length) continue;

  for (const event of sport.events) {
    // make sure event falls within the valid week window
    const gameDate = moment.utc(event.date).tz("America/Los_Angeles").format("YYYYMMDD");
    if (!upcomingWeekDates.includes(gameDate)) {
      logger.warn({ message: "Game date not in upcoming week", anomalyData: { gameDate, event } });
      continue;
    }

    const { name: gameStatus } = event.status.type;
    if (gameStatus !== "STATUS_SCHEDULED") continue;

    const matchup: IPotentialMatchup = {
      id: uuidv4(),
      eventId: event.id,
      gameTime: event.date,
      name: event.name,
      gameDate,
      league,
      gameStatus,
      drawEligible: isDrawEligible(league),
    };

    formattedMatchups.push(matchup);
  }
}

const existingMatchups = await prisma.potentialMatchup.findMany({
  where: {
    gameDate: {
      in: upcomingWeekDates,
    },
  },
  select: {
    eventId: true,
  },
});

const existingDbEventIds = existingMatchups.map(({ eventId }) => eventId);

const deDupedMatchups = formattedMatchups.filter(
  ({ eventId }) => !existingDbEventIds.includes(eventId)
);

const insertCount = await prisma.potentialMatchup.createMany({
  data: deDupedMatchups,
});

logger.info({ message: `${insertCount.count} potential matchups added` });

await prisma.$disconnect();
