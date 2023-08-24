import dotenv from "dotenv";
import moment from "moment";
import "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import logger from "./winstonLogger.ts";
import { handleNetworkError } from "./utils/matchupFinderUtils.ts";
import { leagueLookup } from "./utils/leagueMap.ts";
import {
  OddsLookup,
  dayRangeLaTimezone,
  getLeagueFromDistribution,
  getLeagueWeightRanges,
  getValidGameOdds,
  parseOdds,
} from "./utils/matchupBuilderUtils.ts";
import {
  GameRows,
  GameView,
  GenericError,
  Matchup,
  Odds,
  OddsView,
  isGenericError,
} from "./interfaces/matchup.ts";
import { augustWeightingModel } from "./lib/leagueWeights.ts";
import axios from "axios";
import Queue from "bull";
import { OddsQueuePayload } from "./interfaces/queue.ts";
import { getOddsQueueDelay } from "./utils/oddsQueueUtils.ts";

dotenv.config();

const prisma = new PrismaClient();
const queue = new Queue("oddsQueue", process.env.REDIS_HOST!);

queue.on("error", error => {
  logger.error({ message: "error adding to oddsQueue", error });
});

const daysInFuture = Number(process.env.ODDS_DAY_OFFSET) || 0;
const targetDate = moment().add(daysInFuture, "day").format("YYYY-MM-DD");
const dateRanges = dayRangeLaTimezone(targetDate);

const matchups: Matchup[] = await prisma.matchups.findMany({
  where: {
    strTimestamp: dateRanges,
  },
  orderBy: [
    {
      strTimestamp: "asc",
    },
    {
      id: "asc",
    },
  ],
});

type OddsType = "money-line" | "totals" | "pointspread";
function isOddsType(value: string): value is OddsType {
  return value === "money-line" || value === "totals" || value === "pointspread";
}

const todaysLeagueIds = new Set<string>();
const leagueNameToOddsType = new Map<string, Set<OddsType>>();

matchups.forEach((matchup: Matchup) => {
  const { idLeague, oddsType } = matchup;

  if (!isOddsType(oddsType)) return;

  todaysLeagueIds.add(idLeague);

  const oddsTypeSet =
    leagueNameToOddsType.get(leagueLookup[idLeague]) ?? new Set<OddsType>([oddsType]);

  oddsTypeSet.add(oddsType);

  leagueNameToOddsType.set(leagueLookup[idLeague], oddsTypeSet);
});

interface LinesResponse {
  league: string;
  oddsType: OddsType;
  data: GameRows[] | GenericError | null;
}

const linesRequests = [...leagueNameToOddsType.entries()].map(([league, oddsTypes]) => {
  const oddsScope = "full-game";

  const responses: Promise<LinesResponse>[] = [...oddsTypes].map(async oddsType => {
    try {
      const { data } = await axios.get(
        `${process.env.LINES_BASE_URL}/${league}/${oddsType}/${oddsScope}.json?date=${targetDate}`
      );
      const gameData = data?.pageProps?.oddsTables?.[0]?.oddsTableModel?.gameRows ?? null;

      const gameRows: GameRows[] | null =
        gameData?.map(({ gameView, oddsViews }: { gameView: GameView; oddsViews: OddsView[] }) => ({
          gameView,
          oddsViews,
        })) ?? null;

      return {
        league,
        oddsType,
        data: gameRows,
      };
    } catch (error) {
      return {
        league,
        oddsType,
        data: handleNetworkError(error),
      };
    }
  });
  return responses;
});

const lines = await Promise.all(linesRequests.flat());

const oddsLookup: OddsLookup = lines.reduce((acc: OddsLookup, cv) => {
  const { league, oddsType, data } = cv;
  if (!data || isGenericError(data)) return acc;

  if (!acc[league]) acc[league] = {};

  const existingData = acc[league][oddsType];

  if (!existingData) {
    acc[league][oddsType] = data;
  } else {
    acc[league][oddsType] = { ...data, ...existingData };
  }

  return acc;
}, {});

const adminSelectedMatchups: Matchup[] = [];
const standardMatchups: Matchup[] = [];
const existingMatchups: Matchup[] = [];

matchups.forEach(matchup => {
  if (matchup.used) {
    existingMatchups.push(matchup);
    return;
  }
  if (matchup.adminSelected) {
    adminSelectedMatchups.push(matchup);
    return;
  }
  standardMatchups.push(matchup);
});

const adminSelectedMatchupOdds: Odds[] = [];
const adminSelectedMatchupsToEnqueue: OddsQueuePayload[] = [];

adminSelectedMatchups.forEach((matchup: Matchup) => {
  const { id, idLeague, oddsType, strTimestamp } = matchup;

  const gameRow = parseOdds(matchup, oddsLookup, leagueLookup);

  if (!gameRow) {
    logger.error({
      message: "No team match in game row",
      anomalyData: { matchupId: id, league: idLeague, oddsType },
    });
    return;
  }

  const { gameView, oddsViews } = gameRow;

  if (!gameView || !oddsViews) {
    logger.error({
      message: "missing game view or odds view",
      anomalyData: { matchupId: id, league: idLeague },
    });
    return;
  }

  const gameOdds = getValidGameOdds(oddsViews, oddsType);

  if (!gameOdds?.currentLine) {
    logger.error({
      message: "no game odds found",
      anomalyData: { matchupId: id, league: idLeague, oddsType },
    });
    return;
  }

  const { homeOdds, awayOdds, drawOdds, overOdds, underOdds, homeSpread, awaySpread, total } =
    gameOdds.currentLine;

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

  adminSelectedMatchupOdds.push(odds);
  adminSelectedMatchupsToEnqueue.push({ id, gameStartTime: strTimestamp });
});

const [adminSelectedInserted, adminSelectedMatchupsUpdated] = await prisma.$transaction([
  prisma.odds.createMany({
    data: adminSelectedMatchupOdds,
  }),
  prisma.matchups.updateMany({
    where: {
      id: {
        in: adminSelectedMatchupsToEnqueue.map(({ id }) => id),
      },
    },
    data: {
      used: true,
    },
  }),
]);

logger.info(`${adminSelectedInserted.count} odds entries added for admin-selected matchups`);
logger.info(
  `${adminSelectedMatchupsUpdated.count} admin-selected matchups updated to 'used' status`
);

for (const { id, gameStartTime } of adminSelectedMatchupsToEnqueue) {
  const delay = getOddsQueueDelay(gameStartTime);
  await queue.add({ id, secondsDelay: delay, delay });
}

// targeting 20 matchups per day
const standardMatchupsNeeded = Math.min(
  20 - existingMatchups.length - adminSelectedInserted.count,
  standardMatchups.length
);

/*
Keeps a count of matchups per league that have NOT been selected and assigned odds. When all games from 
a league have been selected, the league is deleted from the map so the league weights can be recalculated
from the map keys that are passed to getLeagueWeightRanges()
*/
const unusedMatchupsPerLeague = standardMatchups.reduce((acc: Map<string, number>, cv: Matchup) => {
  const currentCount = acc.get(cv.idLeague) ?? 0;
  acc.set(cv.idLeague, currentCount + 1);
  return acc;
}, new Map());

const standardMatchupOdds: Odds[] = [];
const standardMatchupsToEnqueue: OddsQueuePayload[] = [];
const seenMatchupsIds = new Set<string>();
let errorCount = 0;

while (standardMatchupOdds.length < standardMatchupsNeeded) {
  // safeguard against infinite while loop
  if (errorCount > standardMatchupsNeeded) {
    logger.error({ message: "forcefully terminated while loop", errorCount });
    break;
  }

  const leagueWeights = getLeagueWeightRanges(
    [...unusedMatchupsPerLeague.keys()],
    augustWeightingModel
  );

  const league = getLeagueFromDistribution(leagueWeights);

  if (!league) {
    logger.warn({
      message: "league not in distribution",
      anomalyData: { leagueWeights: JSON.stringify(leagueWeights) },
    });
    errorCount++;
    continue;
  }

  const unusedCount = unusedMatchupsPerLeague.get(league);
  if (!unusedCount || unusedCount < 0) {
    logger.warn({
      message: "no unused matchups found for league",
      anomalyData: { league },
    });
    errorCount++;
    continue;
  }

  const leagueMatchups = standardMatchups.filter(
    ({ idLeague, id }) => idLeague === league && !seenMatchupsIds.has(id)
  );

  if (!leagueMatchups.length) {
    logger.warn({
      message: `no odds yet for remaining games in league ${league}`,
      anomalyData: { league },
    });
    errorCount++;
    continue;
  }

  // pick random game from chosen league
  const randomIndex = Math.floor(Math.random() * leagueMatchups.length);
  const matchup = leagueMatchups[randomIndex];

  const { id, idLeague, oddsType, strTimestamp } = matchup;
  seenMatchupsIds.add(id);

  const gameRow = parseOdds(matchup, oddsLookup, leagueLookup);

  if (!gameRow) {
    logger.warn({
      message: "No team match in game row",
      anomalyData: { matchupId: id, league: idLeague, oddsType },
    });
    errorCount++;
    continue;
  }

  const { gameView, oddsViews } = gameRow;

  if (!gameView || !oddsViews) {
    logger.error({
      message: "missing game view or odds view",
      anomalyData: { matchupId: id, league: idLeague },
    });
    errorCount++;
    continue;
  }

  const gameOdds = getValidGameOdds(oddsViews, oddsType);

  if (!gameOdds?.currentLine) {
    logger.error({
      message: "no game odds found",
      anomalyData: { matchupId: id, league: idLeague, oddsType },
    });
    errorCount++;
    continue;
  }

  const { homeOdds, awayOdds, drawOdds, overOdds, underOdds, homeSpread, awaySpread, total } =
    gameOdds.currentLine;

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

  standardMatchupOdds.push(odds);
  standardMatchupsToEnqueue.push({ id, gameStartTime: strTimestamp });

  if (unusedCount <= 1) {
    unusedMatchupsPerLeague.delete(league);
  } else {
    unusedMatchupsPerLeague.set(league, unusedCount - 1);
  }
}

const [standardMatchupOddsInserted, standardMatchupsUpdated] = await prisma.$transaction([
  prisma.odds.createMany({
    data: standardMatchupOdds,
  }),
  prisma.matchups.updateMany({
    where: {
      id: {
        in: standardMatchupsToEnqueue.map(({ id }) => id),
      },
    },
    data: {
      used: true,
    },
  }),
]);

logger.info(`${standardMatchupOddsInserted.count} odds entries added for standard matchups`);
logger.info(`${standardMatchupsUpdated.count} standard matchups updated to 'used' status`);

for (const { id, gameStartTime } of standardMatchupsToEnqueue) {
  const delay = getOddsQueueDelay(gameStartTime);
  await queue.add({ id, secondsDelay: delay, delay });
}

await queue.close();
await prisma.$disconnect();