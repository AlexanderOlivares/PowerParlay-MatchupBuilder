import dotenv from "dotenv";
import moment from "moment";
import "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import logger from "./winstonLogger.ts";
import { getUpcomingWeekDates, promiseDotAll } from "./utils/matchupFinderUtils.ts";

dotenv.config();

const prisma = new PrismaClient();

const MLB = process.env.MLB as string;
const MLS = process.env.MLS as string;

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
