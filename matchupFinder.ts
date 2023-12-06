import dotenv from "dotenv";
import moment from "moment";
import "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import logger from "./winstonLogger.ts";
import {
  getUpcomingWeekDates,
  handleNetworkError,
  makeIsoIfUnixTimestamp,
  missingMandatoryFields,
} from "./utils/matchupFinderUtils.ts";
import { SOCCER_LEAGUES, leagueLookup } from "./utils/leagueMap.ts";
import { EventData, GenericError, Matchup, Media, isGenericError } from "./interfaces/matchup.ts";
import axios from "axios";
import Bottleneck from "bottleneck";

dotenv.config();

const limiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 1000,
});

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

const leagueEvents = allEvents
  .flat()
  .filter(event => event && !isGenericError(event)) as EventData[];

function isDrawEligible(league: string) {
  return SOCCER_LEAGUES.includes(league);
}

const teamIds = leagueEvents.flatMap(({ idAwayTeam, idHomeTeam }) => [idAwayTeam, idHomeTeam]);

const teamsWithAssets: Media[] = await prisma.media.findMany({
  where: { teamId: { in: teamIds } },
});

const teamIdsWithAssets = teamsWithAssets.map(({ teamId }) => teamId);

const teamIdsMissingAssets: string[] = teamIds.filter(
  eventId => !teamIdsWithAssets.includes(eventId)
);

logger.warn({ message: `Missing media from ${teamIdsMissingAssets.length} teams` });

async function fetchTeamRequest(teamId: string) {
  return await limiter.schedule(async () => {
    try {
      const { data } = await axios.get(`${SPORTS_BASE_URL}lookupteam.php?id=${teamId}`);
      const teamData = data?.teams[0];
      if (!teamData) return null;
      const { strTeamBadge, strTeamJersey, strTeamLogo, strTeam } = teamData;
      if ([strTeamBadge, strTeamJersey, strTeamLogo, strTeam].some(field => !field)) return null;
      return {
        [teamId]: {
          strTeam,
          strTeamBadge,
          strTeamJersey,
          strTeamLogo,
        },
      };
    } catch (error) {
      handleNetworkError(error);
      return Promise.resolve(null);
    }
  });
}

const requestsForMediaAssets = [];
const seenTeamIds = new Map<string, boolean>();

for (const teamId of teamIdsMissingAssets) {
  if (seenTeamIds.has(teamId)) continue;
  requestsForMediaAssets.push(fetchTeamRequest(teamId));
  seenTeamIds.set(teamId, true);
}

const mediaData = await Promise.all(requestsForMediaAssets);

const teamMediaRecords = mediaData.filter(Boolean).map(team => {
  // @ts-ignore
  const [teamId, media] = Object.entries(team)[0];
  const { strTeamBadge, strTeamJersey, strTeamLogo, strTeam } = media;
  return {
    teamId,
    teamName: strTeam,
    badgeId: strTeamBadge,
    logoId: strTeamLogo,
    jerseyId: strTeamJersey,
  };
});

const mediaInsertCount = await prisma.media.createMany({ data: teamMediaRecords });

logger.info({ message: `Added media for ${mediaInsertCount.count} teams` });

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
  // "strThumb", temp omit since college football doesn't have thumbs posted
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

  const gameStartTime = makeIsoIfUnixTimestamp(strTimestamp);
  // make sure event falls within the valid week window
  const gameDate = moment.utc(gameStartTime).tz("America/Los_Angeles").format("YYYY-MM-DD");
  if (!upcomingWeekDates.includes(gameDate)) {
    logger.warn({
      message: "Game date not in upcoming week",
      anomalyData: { gameDate, idEvent, strTimestamp, gameStartTime },
    });
    continue;
  }

  const awayBadgeId =
    teamsWithAssets.find(team => team.teamId === idAwayTeam)?.badgeId ||
    teamMediaRecords.find(team => team.teamId === idAwayTeam)?.badgeId;

  const homeBadgeId =
    teamsWithAssets.find(team => team.teamId === idHomeTeam)?.badgeId ||
    teamMediaRecords.find(team => team.teamId === idHomeTeam)?.badgeId;

  if (!awayBadgeId || !homeBadgeId) {
    logger.error({
      message: "Missing team badge(s)",
      anomalyData: { gameDate, idEvent, idAwayTeam, idHomeTeam },
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
    strTimestamp: gameStartTime,
    strThumb,
    awayBadgeId,
    homeBadgeId,
    oddsType: "money-line",
    oddsScope: "full-game",
    drawEligible: isDrawEligible(idLeague),
    adminSelected: false,
    used: false,
    awayScore: null,
    homeScore: null,
    pointsTotal: null,
    status: "NS",
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
