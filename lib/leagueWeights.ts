import { WeightingModel } from "../utils/matchupBuilderUtils";

export const augustWeightingModel: WeightingModel = {
  "4424": 0.3, // mlb-baseball
  "4346": 0.1, // major-league-soccer
  "4516": 0.04, // wnba-basketball
  "4328": 0.1, //"english-premier-league"
  "4331": 0.02, //  bundesliga
  "4335": 0.05, //  "la-liga"
  "4334": 0.02, //  ligue1
  "4332": 0.02, //  "serie-a"
  "4480": 0.05, //  "champions-league"
  //  "4481": 0, //  "europa-league"
  "4391": 0.3, //  "nfl-football"
  //  "4479": 0, //  "college-football"
  //  "4387": 0, //  "nba-basketball"
  //  "4607": 0, //  "ncaa-basketball"
  //  "4380": 0, //  "nhl-hockey"
};
