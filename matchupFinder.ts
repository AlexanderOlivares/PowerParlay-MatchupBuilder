import dotenv from "dotenv";
import moment from "moment";
import "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import logger from "./winstonLogger.ts";
import {
  getUpcomingWeekDates,
  missingMandatoryFields,
  promiseDotAll,
} from "./utils/matchupFinderUtils.ts";
import { leagueLookup } from "./utils/leagueMap.ts";

dotenv.config();

const prisma = new PrismaClient();

const upcomingWeekDates = getUpcomingWeekDates();

const buildSportRequests = Object.values(leagueLookup).flatMap(league => {
  return promiseDotAll(upcomingWeekDates, league);
});

const leagueMatches = await Promise.all(buildSportRequests);

const SOCCER_LEAGUES = ["4346", "4328", "4331", "4335", "4334", "4332", "4480", "4481"];

function isDrawEligible(league: string) {
  return SOCCER_LEAGUES.includes(league);
}

interface IPotentialMatchup {
  id: string;
  idEvent: string;
  idHomeTeam: string;
  idAwayTeam: string;
  idLeague: string;
  strLeague: string;
  strEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strTimestamp: string;
  strThumb: string;
  drawEligible: boolean;
}

const formattedMatchups: IPotentialMatchup[] = [];

const mandatoryFields = [
  "idEvent",
  "idHomeTeam",
  "idAwayTeam",
  "idLeague",
  "strLeague",
  "strEvent",
  "strHomeTeam",
  "strAwayTeam",
  "strTimestamp",
  "strThumb",
];

for (const league of leagueMatches) {
  if (!league || league.error) continue;

  for (const event of league) {
    const isMissingFields = missingMandatoryFields(mandatoryFields, event);
    if (isMissingFields) continue;

    const {
      idEvent,
      idHomeTeam,
      idAwayTeam,
      idLeague,
      strLeague,
      strEvent,
      strHomeTeam,
      strAwayTeam,
      strTimestamp,
      strThumb,
    } = event;

    // make sure event falls within the valid week window
    const gameDate = moment.utc(strTimestamp).tz("America/Los_Angeles").format("YYYY-MM-DD");
    if (!upcomingWeekDates.includes(gameDate)) {
      logger.warn({
        message: "Game date not in upcoming week",
        anomalyData: { gameDate, idEvent, strTimestamp },
      });
      continue;
    }

    const matchup: IPotentialMatchup = {
      id: uuidv4(),
      idEvent,
      idHomeTeam,
      idAwayTeam,
      idLeague,
      strLeague,
      strEvent,
      strHomeTeam,
      strAwayTeam,
      strTimestamp,
      strThumb,
      drawEligible: isDrawEligible(league),
    };

    formattedMatchups.push(matchup);
  }
}

const existingDbMatchups = await prisma.potentialMatchup.findMany({
  where: {
    idEvent: {
      in: formattedMatchups.map(({ idEvent }) => idEvent),
    },
  },
  select: {
    idEvent: true,
  },
});

if (existingDbMatchups?.length) {
  logger.warn({
    message: "Duplicate games in result set",
    duplicateCount: existingDbMatchups.length,
  });
}

const existingDbEventIds = existingDbMatchups.map(({ idEvent }) => idEvent);

const dedupedMatchups = formattedMatchups.filter(
  ({ idEvent }) => !existingDbEventIds.includes(idEvent)
);

const insertCount = await prisma.potentialMatchup.createMany({
  data: dedupedMatchups,
});

logger.info({ message: `${insertCount.count} potential matchups added` });

await prisma.$disconnect();
