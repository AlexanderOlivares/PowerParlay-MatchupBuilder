import { WeightingModel } from "../utils/matchupBuilderUtils";

export const fallWeightingModel: WeightingModel = {
  "4424": 0.22, // mlb-baseball
  "4346": 0.04, // major-league-soccer
  "4516": 0.02, // wnba-basketball
  "4328": 0.04, //"english-premier-league"
  "4331": 0.02, //  bundesliga
  "4335": 0.02, //  "la-liga"
  "4334": 0.01, //  ligue1
  "4332": 0.01, //  "serie-a"
  "4480": 0.02, //  "champions-league"
  //  "4481": 0, //  "europa-league"
  "4391": 0.3, //  "nfl-football"
  "4479": 0.3, //  "college-football"
  //  "4387": 0, //  "nba-basketball"
  //  "4607": 0, //  "ncaa-basketball"
  //  "4380": 0, //  "nhl-hockey"
};
