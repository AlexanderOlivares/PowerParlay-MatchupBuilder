import moment from "moment";
import {
  MatchupResult,
  OddsTypeSelectFields,
  isMoneylineOdds,
  isPointSpreadOdds,
  isTotalsOdds,
} from "../interfaces/queue.ts";

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
  // if (hours > 2) return 180000; // 3 minutes
  // if (hours > 1) return 600000; // 10 minutes
  // return 1800000; // 30 minutes

  // testing new delay times
  if (hours > 2) return 600000; // 10 minutes
  if (hours > 1) return 1800000; // 30 minutes
  return 3600000; // 1 hour
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

export function getSelectFieldsForOddsType(
  oddsType: "money-line" | "totals" | "pointspread"
): OddsTypeSelectFields {
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
  const noWinningOdds = { winningOdds: null };
  if (oddsType === "totals" && isTotalsOdds(odds)) {
    if (pointsTotal === odds.total) return { result: "push", ...noWinningOdds };
    const { overOdds, underOdds } = odds;
    const outcome = pointsTotal > odds.total ? "over" : "under";
    if (pick === outcome) {
      // pick is a win
      const winningOdds = pick === "over" ? overOdds : underOdds;
      return { result: "win", winningOdds };
    }
    return { result: "loss", ...noWinningOdds };
  }

  if (oddsType === "money-line" && isMoneylineOdds(odds)) {
    const { awayOdds, homeOdds, drawOdds } = odds;
    const isDraw = awayScore === homeScore;
    // Football offers no draw odds but can end in a tie
    if (isDraw && !drawEligible) return { result: "push", ...noWinningOdds };

    // Used for soccer where one team will be picked to win or draw
    if (isDraw) {
      if (pick !== drawTeam) return { result: "loss", ...noWinningOdds };
      const pickedTeamOdds = drawTeam === strAwayTeam ? awayOdds : homeOdds;
      const winOrDrawOdds = getWinOrDrawOdds(pickedTeamOdds, drawOdds);
      return { result: "win", winningOdds: winOrDrawOdds };
    }

    const winner = awayScore > homeScore ? strAwayTeam : strHomeTeam;
    if (pick === winner) {
      const winningOdds = pick === strAwayTeam ? awayOdds : homeOdds;
      return { result: "win", winningOdds };
    }
    return { result: "loss", ...noWinningOdds };
  }

  if (oddsType === "pointspread" && isPointSpreadOdds(odds)) {
    const { awaySpread, homeSpread, awayOdds, homeOdds } = odds;
    // Football edge case where spread is 0 and game ends in tie
    if (awaySpread === 0 && homeScore === awayScore) {
      return { result: "push", ...noWinningOdds };
    }

    // away team is favorite
    if (awaySpread < homeSpread) {
      if (awayScore - Math.abs(awaySpread) === homeScore) {
        return { result: "push", ...noWinningOdds };
      }
      const awayTeamCoveredSpread = awayScore - Math.abs(awaySpread) > homeScore;
      const winningOdds = pick === strAwayTeam ? awayOdds : homeOdds;
      if (awayTeamCoveredSpread) {
        return pick === strAwayTeam
          ? { result: "win", winningOdds }
          : { result: "loss", ...noWinningOdds };
      }
      return pick === strHomeTeam
        ? { result: "win", winningOdds }
        : { result: "loss", ...noWinningOdds };
    }

    // home team is favorite
    if (awaySpread > homeSpread) {
      if (homeScore - Math.abs(homeSpread) === awayScore) {
        return { result: "push", ...noWinningOdds };
      }
      const homeTeamCoveredSpread = homeScore - Math.abs(homeSpread) > awayScore;
      const winningOdds = pick === strHomeTeam ? homeOdds : awayOdds;
      if (homeTeamCoveredSpread) {
        return pick === strHomeTeam
          ? { result: "win", winningOdds }
          : { result: "loss", ...noWinningOdds };
      }
      return pick === strAwayTeam
        ? { result: "win", winningOdds }
        : { result: "loss", ...noWinningOdds };
    }
  }
  throw new Error("Could not determine pick result. Needs admin review");
}

export function getPointsAwarded(betAmount: number, odds: number) {
  const isPositiveOdds = odds >= 0;
  const MULTIPLIER = 100000;
  const withMultiplier = isPositiveOdds
    ? betAmount * (odds / 100) * MULTIPLIER
    : (betAmount / (Math.abs(odds) / 100)) * MULTIPLIER;
  return parseFloat((withMultiplier / MULTIPLIER + betAmount).toFixed(2));
}

export function americanToDecimalOdds(americanOdds: number): number {
  const unrounded = americanOdds > 0 ? americanOdds / 100 + 1 : 100 / Math.abs(americanOdds) + 1;
  return parseFloat(unrounded.toFixed(2));
}

export function decimalToAmericanOdds(decimalOdds: number): number {
  const unrounded =
    decimalOdds >= 2.0
      ? ((decimalOdds - 1) * 100).toFixed(2)
      : (-100 / (decimalOdds - 1)).toFixed(2);
  return Math.round(parseFloat(unrounded));
}

export function getWinOrDrawOdds(teamOdds: number, drawOdds: number) {
  const teamDecimalOdds = americanToDecimalOdds(teamOdds);
  const drawDecimalOdds = americanToDecimalOdds(drawOdds);
  const rawOdds = 1 / (1 / teamDecimalOdds + 1 / drawDecimalOdds);
  const decimalWinOrDrawOdds = parseFloat(rawOdds.toFixed(2));
  return decimalToAmericanOdds(decimalWinOrDrawOdds);
}

export function calculateParlayPayout(betAmount: number, odds: number[]): number {
  const parlayPayout = odds.map(americanToDecimalOdds).reduce((a, c) => a * c, betAmount);
  return parseFloat(parlayPayout.toFixed(2));
}
