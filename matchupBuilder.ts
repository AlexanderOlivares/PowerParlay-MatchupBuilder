import dotenv from "dotenv";
import moment from "moment";
import "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import { Matchups, PrismaClient } from "@prisma/client";
import logger from "./winstonLogger.ts";
import { handleNetworkError } from "./utils/matchupFinderUtils.ts";
import { leagueLookup } from "./utils/leagueMap.ts";
import {
  dayRangeLaTimezone,
  getLeagueWeightRanges,
  mandatoryOddsFields,
} from "./utils/matchupBuilderUtils.ts";
import { GameView, GenericError, Odds, OddsView, isGenericError } from "./interfaces/matchup.ts";
import { augustWeightingModel } from "./lib/leagueWeights.ts";
import axios from "axios";

dotenv.config();

const prisma = new PrismaClient();

const now = moment().format("YYYY-MM-DD");
const dateRanges = dayRangeLaTimezone(now);

const matchups: Matchups[] = await prisma.matchups.findMany({
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

const matchupsNeeded = 20 - matchups.length;

export type OddsType = "money-line" | "totals" | "pointspread";
export function isOddsType(value: string): value is OddsType {
  return value === "money-line" || value === "totals" || value === "pointspread";
}

const todaysLeagueIds = new Set<string>();
const leagueNameToOddsType = new Map<string, Set<OddsType>>();

matchups.forEach((matchup: Matchups) => {
  const { idLeague, oddsType } = matchup;

  if (!isOddsType(oddsType)) return;

  todaysLeagueIds.add(idLeague);

  const oddsTypeSet =
    leagueNameToOddsType.get(leagueLookup[idLeague]) ?? new Set<OddsType>([oddsType]);

  oddsTypeSet.add(oddsType);

  leagueNameToOddsType.set(leagueLookup[idLeague], oddsTypeSet);
});

interface GameRows {
  gameView: GameView;
  oddsViews: OddsView[];
}

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
        `${process.env.LINES_BASE_URL}/${league}/${oddsType}/${oddsScope}.json?date=${now}`
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

interface OddsLookup {
  [league: string]: {
    [oddsType: string]: GameRows[];
  };
}
const oddsLookup: OddsLookup = lines.reduce((acc: OddsLookup, { league, oddsType, data }) => {
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

const maxMatchupCount = Math.min(matchupsNeeded, matchups.length);

const adminSelectedMatchups = matchups.filter(matchup => matchup.adminSelected);

const oddsEntries: Odds[] = [];

adminSelectedMatchups.forEach(matchup => {
  const { id, idLeague, oddsType, strAwayTeam, strHomeTeam } = matchup;
  const leagueOddsType = oddsLookup[leagueLookup[idLeague]][oddsType];

  const gameRow = leagueOddsType.find(
    game =>
      game.gameView.awayTeam.fullName === strAwayTeam &&
      game.gameView.homeTeam.fullName === strHomeTeam
  );

  if (!gameRow) {
    logger.warn({
      message: "No team match in game row",
      anomalyData: { matchupId: id, league: idLeague, oddsType },
    });
    return;
  }

  const { gameView, oddsViews } = gameRow;

  if (!gameView || !oddsViews) {
    logger.warn({
      message: "missing game view or odds view",
      anomalyData: { matchupId: id, league: idLeague },
    });
  }

  // TODO make this a testable func
  const gameOdds = oddsViews
    ?.filter(Boolean)
    .find(odds => mandatoryOddsFields[oddsType]?.every(field => odds?.currentLine[field]));

  if (!gameOdds) {
    logger.warn({
      message: "no game odds found",
      anomalyData: { matchupId: id, league: idLeague, oddsType },
    });
    return;
  }

  const { homeOdds, awayOdds, drawOdds, overOdds, underOdds, homeSpread, awaySpread, total } =
    gameOdds?.currentLine;

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

  oddsEntries.push(odds);
});

const insertCount = await prisma.odds.createMany({
  data: oddsEntries,
});

const leagueWeights = getLeagueWeightRanges([...todaysLeagueIds], augustWeightingModel);
