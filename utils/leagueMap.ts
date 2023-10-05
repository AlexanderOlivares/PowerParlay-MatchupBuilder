export interface LeagueLookup {
  [idLeague: string]: string;
}

export const leagueLookup: LeagueLookup = {
  "4424": "mlb-baseball",
  "4346": "major-league-soccer",
  "4516": "wnba-basketball",
  "4328": "english-premier-league",
  "4331": "bundesliga",
  "4335": "la-liga",
  "4334": "ligue1",
  "4332": "serie-a",
  "4480": "champions-league",
  "4481": "europa-league",
  "4391": "nfl-football",
  "4479": "college-football",
  "4387": "nba-basketball",
  //  "4607":   "ncaa-basketball",
  "4380": "nhl-hockey",
};

export const MATCHUP_STATUSES = {
  // as explained here https://www.thesportsdb.com/forum_topic.php?t=5236
  notStarted: ["NS", "Not Started"],
  gameFinished: ["FT", "AOT", "AET", "PEN", "Match Finished", "AP"],
  shouldPush: ["POST", "PST", "SUSP", "CANC", "ABD", "AWD", "WO", "INTR", "INT"],
};
