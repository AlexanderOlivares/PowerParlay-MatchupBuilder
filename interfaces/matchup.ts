type OddsType = "money-line" | "totals" | "pointspread";
type OddsScope =
  | "full-game"
  | "1st-half"
  | "2nd-half"
  | "1st-quarter"
  | "2nd-quarter"
  | "3rd-quarter"
  | "4th-quarter";
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
  oddsType: OddsType;
  oddsScope: OddsScope;
}

export interface Matchup extends PotentialMatchup {
  adminSelected: boolean;
  oddsGameId: string;
  homeOdds: string;
  awayOdds: string;
  drawOdds: string | null;
  lastOddsUpdate: string;
  oddsHistory: string; // need to parse this is json
  oddsType: OddsType;
  oddsScope: OddsScope;
  result: string;
  locked: boolean;
  adminUnlocked: boolean;
  adminCorrected: boolean;
  homeSelected: number;
  awaySelected: number;
}

export interface GenericError {
  genericError: boolean;
}

// type guard
export function isGenericError(obj: unknown): obj is GenericError {
  return (obj as GenericError)?.genericError === true;
}

export interface EventData {
  idEvent: string;
  idSoccerXML: string | null;
  idAPIfootball: string;
  strEvent: string;
  strEventAlternate: string;
  strFilename: string;
  strSport: string;
  idLeague: string;
  strLeague: string;
  strSeason: string;
  strDescriptionEN: string | null;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: number | null;
  intRound: string;
  intAwayScore: number | null;
  intSpectators: number | null;
  strOfficial: string;
  strTimestamp: string;
  dateEvent: string;
  dateEventLocal: string | null;
  strTime: string;
  strTimeLocal: string | null;
  strTVStation: string | null;
  idHomeTeam: string;
  idAwayTeam: string;
  intScore: string | null;
  intScoreVotes: string | null;
  strResult: string | null;
  strVenue: string;
  strCountry: string;
  strCity: string | null;
  strPoster: string;
  strSquare: string;
  strFanart: string | null;
  strThumb: string;
  strBanner: string;
  strMap: string | null;
  strTweet1: string | null;
  strTweet2: string | null;
  strTweet3: string | null;
  strVideo: string | null;
  strStatus: string;
  strPostponed: string;
  strLocked: string;
}
