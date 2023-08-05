import dotenv from "dotenv";
import moment from "moment";
import "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import logger from "./winstonLogger.ts";
import {
  getUpcomingWeekDates,
  handleNetworkError,
  missingMandatoryFields,
} from "./utils/matchupFinderUtils.ts";
import { leagueLookup } from "./utils/leagueMap.ts";
import { EventData, GenericError, Matchup, isGenericError } from "./interfaces/matchup.ts";
import axios from "axios";

dotenv.config();

const prisma = new PrismaClient();

const SPORTS_BASE_URL = process.env.SPORTS_BASE_URL;

const upcomingWeekDates = getUpcomingWeekDates();

const buildSportRequests = Object.keys(leagueLookup).flatMap(league => {
  const response: Promise<Array<EventData | null | GenericError>>[] = upcomingWeekDates.map(
    async date => {
      try {
        const { data } = await axios.get(`${SPORTS_BASE_URL}/eventsday.php?d=${date}&l=${league}`);
        const events: Array<EventData | null> = data.events;
        if (!events) {
          logger.warn({ message: "events data null", anomalyData: { date, league } });
        }
        return data.events;
      } catch (error) {
        return handleNetworkError(error);
      }
    }
  );
  return response;
});

const allEvents = await Promise.all(buildSportRequests);

const leagueEvents = allEvents.flat().filter(event => event && !isGenericError(event));

const SOCCER_LEAGUES = ["4346", "4328", "4331", "4335", "4334", "4332", "4480", "4481"];

function isDrawEligible(league: string) {
  return SOCCER_LEAGUES.includes(league);
}

const formattedMatchups: Matchup[] = [];

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

for (const event of leagueEvents) {
  if (!event || isGenericError(event)) continue;
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

  const matchup: Matchup = {
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
    oddsType: "money-line",
    oddsScope: "full-game",
    drawEligible: isDrawEligible(idLeague),
    adminSelected: false,
    used: false,
    result: "NS",
    locked: false,
    adminUnlocked: false,
    adminCorrected: false,
  };

  formattedMatchups.push(matchup);
}

const existingDbMatchups: Pick<Matchup, "idEvent">[] = await prisma.matchups.findMany({
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

const insertCount = await prisma.matchups.createMany({
  data: dedupedMatchups,
});

logger.info({ message: `${insertCount.count} potential matchups added` });

await prisma.$disconnect();
