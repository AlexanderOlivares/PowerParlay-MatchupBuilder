export interface PotentialMatchup {
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

export interface Matchup extends PotentialMatchup {
  adminSelected: boolean;
  oddsGameId: string;
  homeOdds: string;
  awayOdds: string;
  drawOdds: string | null;
  lastOddsUpdate: string;
  oddsHistory: string; // need to parse this is json
  oddsType: string;
  oddsScope: string;
  result: string;
  locked: boolean;
  adminUnlocked: boolean;
  adminCorrected: boolean;
  homeSelected: number;
  awaySelected: number;
}
