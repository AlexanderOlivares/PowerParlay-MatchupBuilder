import { Matchup, Odds } from "./matchup";

export interface OddsQueuePayload {
  id: string;
  gameStartTime: string;
}

export interface MatchupWithOdds extends Matchup {
  odds: Odds[];
}

export type MatchupResult = Pick<
  Matchup,
  "oddsType" | "drawEligible" | "drawTeam" | "strHomeTeam" | "strAwayTeam"
> & {
  pick: string;
  pointsTotal: number;
  awayScore: number;
  homeScore: number;
  odds: OddsBasedOnOddsType;
};

export type OddsBasedOnOddsType = MoneylineOdds | TotalsOdds | PointSpreadOdds;

export interface MoneylineOdds {
  homeOdds: number;
  awayOdds: number;
  drawOdds: number;
}

export interface TotalsOdds {
  overOdds: number;
  underOdds: number;
  total: number;
}

export interface PointSpreadOdds {
  homeOdds: number;
  awayOdds: number;
  homeSpread: number;
  awaySpread: number;
}

export function isMoneylineOdds(odds: any): odds is MoneylineOdds {
  return odds.homeOdds !== null && odds.awayOdds !== null && odds.drawOdds !== null;
}

export function isTotalsOdds(odds: any): odds is TotalsOdds {
  return odds.overOdds !== null && odds.underOdds !== null && odds.total !== null;
}

export function isPointSpreadOdds(odds: any): odds is PointSpreadOdds {
  return (
    odds.homeOdds !== null &&
    odds.awayOdds !== null &&
    odds.homeSpread !== null &&
    odds.awaySpread !== null
  );
}

export interface MoneylineSelectFields {
  homeOdds: boolean;
  awayOdds: boolean;
  drawOdds: boolean;
}

export interface TotalsSelectFields {
  overOdds: boolean;
  underOdds: boolean;
  total: boolean;
}

export interface PointSpreadSelectFields {
  homeOdds: boolean;
  awayOdds: boolean;
  homeSpread: boolean;
  awaySpread: boolean;
}

export type OddsTypeSelectFields =
  | MoneylineSelectFields
  | TotalsSelectFields
  | PointSpreadSelectFields;

export interface PickAndOddsId {
  pick: string;
  oddsId: string;
}
