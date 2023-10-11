import moment from "moment";
import { MandatoryOddsFields } from "./matchupBuilderUtils";
import { Odds, OddsView } from "../interfaces/matchup";
import { SOCCER_LEAGUES } from "./leagueMap.ts";

export function getOddsQueueDelay(strTimestamp: string): number {
  const now = moment();
  const future = moment(strTimestamp);

  const hours = future.diff(now, "hours");
  const minutes = future.diff(now, "minutes");

  // Delay time in milliseconds
  if (hours > 8) return 14400000; // 4 hours
  if (hours > 4) return 7200000; // 2 hours
  if (hours > 1) return 3600000; // 1 hour
  if (minutes > 30) return 1200000; // 20 minutes
  return 0; // back-off under 30 minutes
}

export function oddsWereUpdated(
  mandatoryOddsFields: MandatoryOddsFields,
  oddsType: string,
  gameOddsCurrentLine: OddsView["currentLine"],
  latestDbOdds: Odds
) {
  return mandatoryOddsFields[oddsType].some(
    odds => gameOddsCurrentLine[odds] !== latestDbOdds[odds]
  );
}

export function getOddsScopes(oddsType: string, idLeague: string, oddsScope = "full-game") {
  if (oddsType === "money-line" && SOCCER_LEAGUES.includes(idLeague)) {
    return "";
  }
  return `/${oddsType}/${oddsScope}`;
}
