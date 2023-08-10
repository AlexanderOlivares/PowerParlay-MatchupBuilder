import moment from "moment";
import "moment-timezone";
import { GameRows, Matchup, OddsView } from "../interfaces/matchup";
import { LeagueLookup } from "./leagueMap";

export function dayRangeLaTimezone(date: string) {
  const startOfDay = moment.tz(date, "America/Los_Angeles").startOf("day");
  const endOfDay = moment(startOfDay).endOf("day");

  return {
    gte: startOfDay.toISOString(),
    lt: endOfDay.toISOString(),
  };
}

export interface WeightingModel {
  [leagueId: string]: number;
}

export interface StartEnd {
  start: number;
  end: number;
}

export function getLeagueWeightRanges(
  leaguesWithGamesToday: string[],
  weightingModel: WeightingModel
) {
  const activeLeagueWeightsTotal = Object.entries(weightingModel)
    .filter(([league]) => leaguesWithGamesToday.includes(league))
    .reduce((acc, [, weight]) => acc + weight, 0);

  const normalizedWeights = new Map<string, StartEnd>();

  const toFixedThree = (num: number) => Number(num.toFixed(3));

  let lowerBound = 0;

  Object.entries(weightingModel)
    .sort((a, b) => a[1] - b[1]) // sort by weight ascending
    .forEach(([league, weight]) => {
      if (leaguesWithGamesToday.includes(league)) {
        const normalizedWeight = toFixedThree(weight / activeLeagueWeightsTotal);
        const range: StartEnd = {
          start: toFixedThree(lowerBound),
          end: toFixedThree(lowerBound + normalizedWeight),
        };
        normalizedWeights.set(league, range);
        lowerBound += normalizedWeight;
      }
    });

  return normalizedWeights;
}

export interface MandatoryOddsFields {
  [key: string]: string[];
  "money-line": string[];
  pointspread: string[];
  totals: string[];
}

export const mandatoryOddsFields: MandatoryOddsFields = {
  "money-line": ["homeOdds", "awayOdds", "drawOdds"],
  pointspread: ["homeOdds", "awayOdds", "homeSpread", "awaySpread"],
  totals: ["overOdds", "underOdds", "total"],
};

export function getValidGameOdds(oddsViews: OddsView[], oddsType: string) {
  return oddsViews
    ?.filter(Boolean)
    .find(odds => mandatoryOddsFields[oddsType]?.every(field => odds?.currentLine[field] !== null));
}

export interface OddsLookup {
  [league: string]: {
    [oddsType: string]: GameRows[];
  };
}

// TODO add tests for this
export function parseOdds(matchup: Matchup, oddsLookup: OddsLookup, leagueLookup: LeagueLookup) {
  const { idLeague, oddsType, strAwayTeam, strHomeTeam } = matchup;
  const leagueOddsType = oddsLookup[leagueLookup[idLeague]][oddsType];

  const gameRow = leagueOddsType.find(
    game =>
      game.gameView.awayTeam.fullName === strAwayTeam &&
      game.gameView.homeTeam.fullName === strHomeTeam
  );

  return gameRow;
}

// TODO add tests for this
export function getLeagueFromDistribution(leagueWeights: Map<string, StartEnd>) {
  const random = Math.random();

  for (const [league, { start, end }] of leagueWeights.entries()) {
    if (random >= start && random < end) {
      return league;
    }
  }
}
