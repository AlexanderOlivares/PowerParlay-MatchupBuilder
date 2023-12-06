export type OddsType = "money-line" | "totals" | "pointspread";
type OddsScope =
  | "full-game"
  | "1st-half"
  | "2nd-half"
  | "1st-quarter"
  | "2nd-quarter"
  | "3rd-quarter"
  | "4th-quarter";

export interface Matchup {
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
  awayBadgeId: string;
  homeBadgeId: string;
  drawEligible: boolean;
  oddsType: string;
  oddsScope: string;
  drawTeam?: string | null;
  adminSelected: boolean;
  used: boolean;
  awayScore: number | null;
  homeScore: number | null;
  pointsTotal: number | null;
  status: string;
  locked: boolean;
  adminUnlocked: boolean;
  adminCorrected: boolean;
}

export interface Odds {
  [key: string]: number | null | undefined | string | Date;
  id: string;
  matchupId: string;
  oddsGameId: number;
  sportsbook: string;
  homeOdds?: number | null;
  awayOdds?: number | null;
  drawOdds?: number | null;
  overOdds?: number | null;
  underOdds?: number | null;
  homeSpread?: number | null;
  awaySpread?: number | null;
  total?: number | null;
  createdAt?: Date;
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
  intHomeScore: string | null;
  intRound: string;
  intAwayScore: string | null;
  intSpectators: string | null;
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

export interface GameView {
  gameId: number;
  leagueName: string;
  startDate: string;
  awayTeam: {
    name: string;
    fullName: string;
    shortName: string;
    displayName: string;
    nickname: string;
    rank: number;
  };
  awayTeamRotationNumber: string | null;
  awayStarter: {
    firstName: string;
    lastName: string;
    throwsShort: string;
    firstInitial: string;
  } | null;
  awayTeamScore: number;
  homeTeam: {
    name: string;
    fullName: string;
    shortName: string;
    displayName: string;
    nickname: string;
    rank: number;
  };
  homeStarter: {
    firstName: string;
    lastName: string;
    throwsShort: string;
    firstInitial: string;
  } | null;
  homeTeamRotationNumber: string | null;
  homeTeamScore: number;
  gameStatusText: string;
  status: string;
  venueName: string;
  city: string;
  state: string;
  country: string;
  consensus: {
    homeMoneyLinePickPercent: number;
    awayMoneyLinePickPercent: number;
    homeSpreadPickPercent: number;
    awaySpreadPickPercent: number;
    overPickPercent: number;
    underPickPercent: number;
  } | null;
}

export interface OddsView {
  [key: string]: any;
  gameId: number;
  sportsbook: string;
  sportsbookId: number | null;
  viewType: string;
  openingLine: {
    odds: number | null;
    homeOdds: number | null;
    awayOdds: number | null;
    overOdds: number | null;
    underOdds: number | null;
    drawOdds: number | null;
    homeSpread: number | null;
    awaySpread: number | null;
    total: number | null;
  };
  // TODO type current line
  currentLine: {
    [key: string]: number | null;
    odds: number | null;
    homeOdds: number | null;
    awayOdds: number | null;
    overOdds: number | null;
    underOdds: number | null;
    drawOdds: number | null;
    homeSpread: number | null;
    awaySpread: number | null;
    total: number | null;
  };
  moneyLineHistory: any; // TODO update type
  spreadHistory: any; // TODO update type
  totalHistory: any; // TODO update type
}

export interface GameRows {
  gameView: GameView;
  oddsViews: (OddsView | null)[];
}

// Currently unused but leaving for possible future use
export interface LiveScore {
  idLiveScore: string;
  idEvent: string;
  strSport: string;
  idLeague: string;
  strLeague: string;
  idHomeTeam: string;
  idAwayTeam: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge: string;
  strAwayTeamBadge: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strPlayer: string | null;
  idPlayer: string | null;
  intEventScore: string | null;
  intEventScoreTotal: string | null;
  strStatus: string;
  strProgress: string;
  strEventTime: string;
  dateEvent: string;
  updated: string;
}

export interface Media {
  teamId: string;
  teamName: string;
  badgeId: string;
  logoId?: string | null;
  jerseyId?: string | null;
}

export interface SelectedPick {
  id: string;
  userId: string;
  parlayId: string;
  oddsId: string;
  matchupId: string;
  locked: boolean;
  useLatestOdds: boolean;
  pick: string;
  result: string;
  createdAt: Date;
  userUpdatedAt?: Date | null;
  Matchups: Matchup;
  // Odds: Odds;
  // Parlay: Parlay;
  // User: User;
}

export interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  emailVerified?: Date | null;
  image?: string | null;
  Account: any[];
  Parlay: Parlay[];
  Pick: SelectedPick[];
  Session: any[];
}

export interface Parlay {
  id: string;
  userId: string;
  locked: boolean;
  createdAt: Date;
  pointsAwarded: number;
  pointsWagered: number;
  User: User | null;
  Pick: SelectedPick[] | null;
}
