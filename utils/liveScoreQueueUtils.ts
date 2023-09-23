import moment from "moment";
import {
  MatchupResult,
  isMoneylineOdds,
  isPointSpreadOdds,
  isTotalsOdds,
} from "../interfaces/queue";

export function getMsToGameTime(strTimestamp: string): number {
  const now = moment();
  // Add 5 seconds of buffer time. This func just needs to be approx
  const gameTime = moment(strTimestamp).add(5, "seconds");
  return gameTime.diff(now);
}

export function getLiveScoreQueueDelay(strTimestamp: string): number {
  const now = moment();
  const gameStartTime = moment(strTimestamp);
  const hours = now.diff(gameStartTime, "hours");

  // Delay time in milliseconds
  if (hours > 2) return 180000; // 3 minutes
  if (hours > 1) return 600000; // 10 minutes
  return 1800000; // 30 minutes
}

export function gameTimeInPast(strTimestamp: string) {
  const gameTime = moment.utc(strTimestamp);
  return gameTime.isBefore(moment.utc());
}

export function convertStringNumberToRealNumber(str: string) {
  const num = Number(str);
  if (num === 0) {
    return num;
  } else if (!num) {
    throw new Error(`Invalid input: "${str}" is not a valid number.`);
  } else {
    return num;
  }
}

export function getScoresAsNums(awayRawScore: string, homeRawScore: string) {
  const awayScore = convertStringNumberToRealNumber(awayRawScore);
  const homeScore = convertStringNumberToRealNumber(homeRawScore);
  return { awayScore, homeScore };
}

export function getWinner(awayRawScore: string, homeRawScore: string) {
  const awayScore = Number(awayRawScore);
  const homeScore = Number(homeRawScore);
  if (!awayScore || !homeScore) {
    throw new Error("Score(s) are falsy in getWinner");
  }
  if (awayScore === homeScore) return "draw";
  return awayScore > homeScore ? "away" : "home";
}

export function getSelectFieldsForOddsType(oddsType: "money-line" | "totals" | "pointspread") {
  if (oddsType === "money-line") {
    return {
      homeOdds: true,
      awayOdds: true,
      drawOdds: true,
    };
  }
  if (oddsType === "totals") {
    return {
      overOdds: true,
      underOdds: true,
      total: true,
    };
  }
  return {
    homeOdds: true,
    awayOdds: true,
    homeSpread: true,
    awaySpread: true,
  };
}

export function getPickResult({
  awayScore,
  homeScore,
  pointsTotal,
  oddsType,
  drawEligible,
  drawTeam, // name of team that gets wins the pick with either a win or draw
  strAwayTeam,
  strHomeTeam,
  pick, // team name, over, or under
  odds,
}: MatchupResult) {
  if (oddsType === "totals" && isTotalsOdds(odds)) {
    if (pointsTotal === odds.total) return "push";
    const outcome = pointsTotal > odds.total ? "over" : "under";
    return pick === outcome ? "win" : "loss";
  }

  if (oddsType === "money-line" && isMoneylineOdds(odds)) {
    const isDraw = awayScore === homeScore;
    // Football offers no draw odds but can end in a tie
    if (isDraw && !drawEligible) return "push";

    if (isDraw) return drawTeam === pick ? "win" : "loss";

    const winner = awayScore > homeScore ? strAwayTeam : strHomeTeam;
    return pick === winner ? "win" : "loss";
  }

  if (oddsType === "pointspread" && isPointSpreadOdds(odds)) {
    const { awaySpread, homeSpread } = odds;
    // Football edge case where spread is 0 and game ends in tie
    if (awaySpread === 0 && homeScore === awayScore) return "push";

    // away team is favorite
    if (awaySpread < homeSpread) {
      if (awayScore - Math.abs(awaySpread) === homeScore) return "push";
      return awayScore - Math.abs(awaySpread) > homeScore ? "win" : "loss";
    }

    // home team is favorite
    if (awaySpread > homeSpread) {
      if (homeScore - Math.abs(homeSpread) === awayScore) return "push";
      return homeScore - Math.abs(homeSpread) > awayScore ? "win" : "loss";
    }
  }
  throw new Error("Could not determine pick result. Needs admin review");
}
