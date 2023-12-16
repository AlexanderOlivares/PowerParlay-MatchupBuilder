import { test, expect } from "vitest";

import moment from "moment";
import {
  getWinner,
  gameTimeInPast,
  getMsToGameTime,
  getScoresAsNums,
  convertStringNumberToRealNumber,
  // getLiveScoreQueueDelay,
  getPickResult,
  americanToDecimalOdds,
  decimalToAmericanOdds,
  getWinOrDrawOdds,
  calculateParlayPayout,
} from "../utils/liveScoreQueueUtils";
import { MatchupResult } from "../interfaces/queue.ts";

describe("gameTimeInPast", () => {
  test("returns false if game time is in the future", () => {
    const tomorrow = moment.utc().add(1, "day");
    const inOneHour = moment.utc().add(1, "hour");
    const inFiveMinutes = moment.utc().add(5, "minutes");
    const day = gameTimeInPast(tomorrow.toISOString());
    const hour = gameTimeInPast(inOneHour.toISOString());
    const minutes = gameTimeInPast(inFiveMinutes.toISOString());
    expect(day).toBe(false);
    expect(hour).toBe(false);
    expect(minutes).toBe(false);
  });

  test("returns true if game time is in the past", () => {
    const result = gameTimeInPast("2023-01-01T12:00:00Z");
    const yesterday = moment.utc().add(-1, "day");
    const hourAgo = moment.utc().add(-1, "hours");
    const minutesAgo = moment.utc().add(-5, "minutes");
    const day = gameTimeInPast(yesterday.toISOString());
    const hour = gameTimeInPast(hourAgo.toISOString());
    const minute = gameTimeInPast(minutesAgo.toISOString());
    expect(result).toBe(true);
    expect(day).toBe(true);
    expect(hour).toBe(true);
    expect(minute).toBe(true);
  });
});

describe("getMsToGameTime", () => {
  test("returns the amount of ms in the future the gameTime is plus a 5 second added buffer", () => {
    const inOneHour = moment.utc().add(1, "minute");
    const result = getMsToGameTime(inOneHour.toISOString());
    expect(result).toBe(65000); // plus 5000
  });
});

describe("getWinner", () => {
  test("compares scores and returns 'away', 'home' or 'draw' to denote the winner", () => {
    expect(getWinner("12", "11")).toEqual("away");
    expect(getWinner("10", "17")).toEqual("home");
    expect(getWinner("14", "14")).toEqual("draw");
    //@ts-ignore
    expect(() => getWinner("14", undefined)).toThrow(Error);
  });
});

describe("getScoresAsNums", () => {
  test("returns an object with awayScore and homeScore each as number types", () => {
    expect(getScoresAsNums("12", "11")).toEqual({ awayScore: 12, homeScore: 11 });
    expect(getScoresAsNums("0", "21")).toEqual({ awayScore: 0, homeScore: 21 });
    expect(getScoresAsNums("0", "21")).toHaveProperty("awayScore");
    expect(getScoresAsNums("0", "21")).toHaveProperty("homeScore");
  });
});

describe("convertStringNumberToRealNumber", () => {
  test("should return number version of the string input. 0 should not throw error", () => {
    expect(convertStringNumberToRealNumber("0")).toEqual(0);
    expect(convertStringNumberToRealNumber("1")).toEqual(1);
    expect(convertStringNumberToRealNumber("-1")).toEqual(-1);
  });
});

// TODO temporarily extended this delay so test is failing. Uncomment when reverted
// describe("getLiveScoreQueueDelay", () => {
//   test("returns the amount of ms in the future the gameTime is plus a 5 second added buffer", () => {
//     const inThreeHour = moment.utc().subtract(3, "hour");
//     const inTwoHour = moment.utc().subtract(2, "hour");
//     const inFiftyNineMins = moment.utc().subtract(59, "minute");
//     expect(getLiveScoreQueueDelay(inThreeHour.toISOString())).toBe(180000);
//     expect(getLiveScoreQueueDelay(inTwoHour.toISOString())).toBe(600000);
//     expect(getLiveScoreQueueDelay(inFiftyNineMins.toISOString())).toBe(1800000);
//   });
// });

describe("getPickResult", () => {
  test("Testing pointspread -- should return win when an away team favorite covers spread and pick is away team", () => {
    const awayTeamCoverCorrectPick: MatchupResult = {
      awayScore: 10,
      homeScore: 3,
      pointsTotal: 13,
      oddsType: "pointspread",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cowboys",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        homeSpread: 3,
        awaySpread: -3,
      },
    };
    const res = getPickResult(awayTeamCoverCorrectPick);
    expect(res.result).toEqual("win");
    expect(res.winningOdds).toEqual(115);
  });
  test("Testing pointspread -- should return loss when an away team favorite covers spread and pick is home team", () => {
    const awayTeamCoverIncorrectPick: MatchupResult = {
      awayScore: 10,
      homeScore: 3,
      pointsTotal: 13,
      oddsType: "pointspread",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cardinals",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        homeSpread: 3,
        awaySpread: -3,
      },
    };
    const res = getPickResult(awayTeamCoverIncorrectPick);
    expect(res.result).toEqual("loss");
    expect(res.winningOdds).toEqual(null);
  });
  test("Testing pointspread -- should return win when away team does not cover spread and pick is home team", () => {
    const awayTeamNotCoverCorrectPick: MatchupResult = {
      awayScore: 10,
      homeScore: 9,
      pointsTotal: 13,
      oddsType: "pointspread",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cardinals",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        homeSpread: 3,
        awaySpread: -3,
      },
    };
    const res = getPickResult(awayTeamNotCoverCorrectPick);
    expect(res.result).toEqual("win");
    expect(res.winningOdds).toEqual(-140);
  });
  test("Testing pointspread -- should return loss when away team does not cover spread and pick is away team", () => {
    const awayTeamNotCoverIncorrectPick: MatchupResult = {
      awayScore: 10,
      homeScore: 9,
      pointsTotal: 13,
      oddsType: "pointspread",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cowboys",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        homeSpread: 3,
        awaySpread: -3,
      },
    };
    const res = getPickResult(awayTeamNotCoverIncorrectPick);
    expect(res.result).toEqual("loss");
    expect(res.winningOdds).toEqual(null);
  });
  test("Testing pointspread -- should return win when a home team favorite covers spread and pick is home team", () => {
    const homeTeamCoverCorrectPick: MatchupResult = {
      awayScore: 6,
      homeScore: 10,
      pointsTotal: 16,
      oddsType: "pointspread",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cardinals",
      odds: {
        homeOdds: -110,
        awayOdds: 115,
        homeSpread: -3,
        awaySpread: 3,
      },
    };
    const res = getPickResult(homeTeamCoverCorrectPick);
    expect(res.result).toEqual("win");
    expect(res.winningOdds).toEqual(-110);
  });
  test("Testing pointspread -- should return loss when an home team favorite covers spread and pick is away team", () => {
    const homeTeamCoverIncorrectPick: MatchupResult = {
      awayScore: 6,
      homeScore: 10,
      pointsTotal: 16,
      oddsType: "pointspread",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cowboys",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        homeSpread: -3,
        awaySpread: 3,
      },
    };
    const res = getPickResult(homeTeamCoverIncorrectPick);
    expect(res.result).toEqual("loss");
    expect(res.winningOdds).toEqual(null);
  });
  test("Testing pointspread -- should return win when home team favorite does not cover spread and pick is away team", () => {
    const homeTeamNotCoverCorrectPick: MatchupResult = {
      awayScore: 9,
      homeScore: 10,
      pointsTotal: 19,
      oddsType: "pointspread",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cowboys",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        homeSpread: -3,
        awaySpread: 3,
      },
    };
    const res = getPickResult(homeTeamNotCoverCorrectPick);
    expect(res.result).toEqual("win");
    expect(res.winningOdds).toEqual(115);
  });
  test("Testing pointspread -- should return loss when home team favorite does not cover spread and pick is home team", () => {
    const homeTeamNotCoverIncorrectPick: MatchupResult = {
      awayScore: 9,
      homeScore: 10,
      pointsTotal: 19,
      oddsType: "pointspread",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cardinals",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        homeSpread: -3,
        awaySpread: 3,
      },
    };
    const res = getPickResult(homeTeamNotCoverIncorrectPick);
    expect(res.result).toEqual("loss");
    expect(res.winningOdds).toEqual(null);
  });
  test("Testing pointspread -- should return push for a draw ineligible matchup where the spread is a whole number and away favorite team wins by exactly that amount", () => {
    const homeTeamNotCoverIncorrectPick: MatchupResult = {
      awayScore: 21,
      homeScore: 14,
      pointsTotal: 35,
      oddsType: "pointspread",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cowboys",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        homeSpread: 7,
        awaySpread: -7,
      },
    };
    const res = getPickResult(homeTeamNotCoverIncorrectPick);
    expect(res.result).toEqual("push");
    expect(res.winningOdds).toEqual(null);
  });
  test("Testing pointspread -- should return push for a draw ineligible matchup where the spread is a whole number and home favorite team wins by exactly that amount", () => {
    const homeTeamNotCoverIncorrectPick: MatchupResult = {
      awayScore: 7,
      homeScore: 14,
      pointsTotal: 35,
      oddsType: "pointspread",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cowboys",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        homeSpread: -7,
        awaySpread: 7,
      },
    };
    const res = getPickResult(homeTeamNotCoverIncorrectPick);
    expect(res.result).toEqual("push");
    expect(res.winningOdds).toEqual(null);
  });
  test("Testing pointspread -- should return push for a draw ineligible matchup when spread is 0 and game ends in a draw", () => {
    const homeTeamNotCoverIncorrectPick: MatchupResult = {
      awayScore: 9,
      homeScore: 9,
      pointsTotal: 18,
      oddsType: "pointspread",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cardinals",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        homeSpread: 0,
        awaySpread: 0,
      },
    };
    const res = getPickResult(homeTeamNotCoverIncorrectPick);
    expect(res.result).toEqual("push");
    expect(res.winningOdds).toEqual(null);
  });
  // money-line
  test("Testing money-line -- should return push for a draw ineligible matchup when spread is 0 and game ends in a draw", () => {
    const push: MatchupResult = {
      awayScore: 9,
      homeScore: 9,
      pointsTotal: 18,
      oddsType: "money-line",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cardinals",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        drawOdds: 0,
      },
    };
    const res = getPickResult(push);
    expect(res.result).toEqual("push");
    expect(res.winningOdds).toEqual(null);
  });
  test("Testing money-line -- should return a win for home team", () => {
    const homeWin: MatchupResult = {
      awayScore: 9,
      homeScore: 21,
      pointsTotal: 18,
      oddsType: "money-line",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cardinals",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        drawOdds: 0,
      },
    };
    const res = getPickResult(homeWin);
    expect(res.result).toEqual("win");
    expect(res.winningOdds).toEqual(-140);
  });
  test("Testing money-line -- should return a win for away team", () => {
    const awayWin: MatchupResult = {
      awayScore: 9,
      homeScore: 3,
      pointsTotal: 18,
      oddsType: "money-line",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cowboys",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        drawOdds: 0,
      },
    };
    const res = getPickResult(awayWin);
    expect(res.result).toEqual("win");
    expect(res.winningOdds).toEqual(115);
  });
  test("Testing money-line -- should return a loss for home team", () => {
    const homeLoss: MatchupResult = {
      awayScore: 9,
      homeScore: 3,
      pointsTotal: 18,
      oddsType: "money-line",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cardinals",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        drawOdds: 0,
      },
    };
    const res = getPickResult(homeLoss);
    expect(res.result).toEqual("loss");
    expect(res.winningOdds).toEqual(null);
  });
  test("Testing money-line -- should return a loss for away team", () => {
    const awayLoss: MatchupResult = {
      awayScore: 9,
      homeScore: 13,
      pointsTotal: 18,
      oddsType: "money-line",
      drawEligible: false,
      drawTeam: null,
      strAwayTeam: "Cowboys",
      strHomeTeam: "Cardinals",
      pick: "Cowboys",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        drawOdds: 0,
      },
    };
    const res = getPickResult(awayLoss);
    expect(res.result).toEqual("loss");
    expect(res.winningOdds).toEqual(null);
  });
  test("Testing money-line (win or draw odds) -- should return a win for away team in a draw", () => {
    const awayWinOnADraw: MatchupResult = {
      awayScore: 2,
      homeScore: 2,
      pointsTotal: 4,
      oddsType: "money-line",
      drawEligible: true,
      drawTeam: "Austin FC",
      strAwayTeam: "Austin FC",
      strHomeTeam: "Houston Dynamo",
      pick: "Austin FC",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        drawOdds: 250,
      },
    };
    // @ts-ignore
    const { awayOdds, drawOdds } = awayWinOnADraw.odds;
    const winOrDrawOdds = getWinOrDrawOdds(awayOdds, drawOdds);
    const res = getPickResult(awayWinOnADraw);
    expect(res.result).toEqual("win");
    expect(res.winningOdds).toEqual(winOrDrawOdds);
  });
  test("Testing money-line (win or draw odds) -- should return a win for home team in a draw", () => {
    const homeWinOnADraw: MatchupResult = {
      awayScore: 2,
      homeScore: 2,
      pointsTotal: 4,
      oddsType: "money-line",
      drawEligible: true,
      drawTeam: "Houston Dynamo",
      strAwayTeam: "Austin FC",
      strHomeTeam: "Houston Dynamo",
      pick: "Houston Dynamo",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        drawOdds: 250,
      },
    };
    // @ts-ignore
    const { homeOdds, drawOdds } = homeWinOnADraw.odds;
    const winOrDrawOdds = getWinOrDrawOdds(homeOdds, drawOdds);
    const res = getPickResult(homeWinOnADraw);
    expect(res.result).toEqual("win");
    expect(res.winningOdds).toEqual(winOrDrawOdds);
  });
  test("Testing money-line -- should return a loss for away team in a draw", () => {
    const awayLossOnADraw: MatchupResult = {
      awayScore: 2,
      homeScore: 2,
      pointsTotal: 4,
      oddsType: "money-line",
      drawEligible: true,
      drawTeam: "Houston Dynamo",
      strAwayTeam: "Austin FC",
      strHomeTeam: "Houston Dynamo",
      pick: "Austin FC",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        drawOdds: 250,
      },
    };
    const res = getPickResult(awayLossOnADraw);
    expect(res.result).toEqual("loss");
    expect(res.winningOdds).toEqual(null);
  });
  test("Testing money-line -- should return a loss for home team in a draw", () => {
    const homeLossOnADraw: MatchupResult = {
      awayScore: 2,
      homeScore: 2,
      pointsTotal: 4,
      oddsType: "money-line",
      drawEligible: true,
      drawTeam: "Austin FC",
      strAwayTeam: "Austin FC",
      strHomeTeam: "Houston Dynamo",
      pick: "Houston Dynamo",
      odds: {
        homeOdds: -140,
        awayOdds: 115,
        drawOdds: 250,
      },
    };
    const res = getPickResult(homeLossOnADraw);
    expect(res.result).toEqual("loss");
    expect(res.winningOdds).toEqual(null);
  });
  test("Testing totals -- should return a win for over", () => {
    const overWin: MatchupResult = {
      awayScore: 2,
      homeScore: 2,
      pointsTotal: 4,
      oddsType: "totals",
      drawEligible: false,
      drawTeam: "Austin FC",
      strAwayTeam: "Austin FC",
      strHomeTeam: "Houston Dynamo",
      pick: "over",
      odds: {
        overOdds: -115,
        underOdds: 115,
        total: 3.5,
      },
    };
    const res = getPickResult(overWin);
    expect(res.result).toEqual("win");
    expect(res.winningOdds).toEqual(-115);
  });
  test("Testing totals -- should return a win for under", () => {
    const underWin: MatchupResult = {
      awayScore: 2,
      homeScore: 2,
      pointsTotal: 4,
      oddsType: "totals",
      drawEligible: false,
      drawTeam: "Austin FC",
      strAwayTeam: "Austin FC",
      strHomeTeam: "Houston Dynamo",
      pick: "under",
      odds: {
        overOdds: -115,
        underOdds: 115,
        total: 4.5,
      },
    };
    const res = getPickResult(underWin);
    expect(res.result).toEqual("win");
    expect(res.winningOdds).toEqual(115);
  });
  test("Testing totals -- should return a loss for over", () => {
    const overLoss: MatchupResult = {
      awayScore: 2,
      homeScore: 0,
      pointsTotal: 2,
      oddsType: "totals",
      drawEligible: false,
      drawTeam: "Austin FC",
      strAwayTeam: "Austin FC",
      strHomeTeam: "Houston Dynamo",
      pick: "over",
      odds: {
        overOdds: -115,
        underOdds: 115,
        total: 2.5,
      },
    };
    const res = getPickResult(overLoss);
    expect(res.result).toEqual("loss");
    expect(res.winningOdds).toEqual(null);
  });
  test("Testing totals -- should return a loss for under", () => {
    const underLoss: MatchupResult = {
      awayScore: 2,
      homeScore: 1,
      pointsTotal: 3,
      oddsType: "totals",
      drawEligible: false,
      drawTeam: "Austin FC",
      strAwayTeam: "Austin FC",
      strHomeTeam: "Houston Dynamo",
      pick: "under",
      odds: {
        overOdds: -115,
        underOdds: 115,
        total: 2.5,
      },
    };
    const res = getPickResult(underLoss);
    expect(res.result).toEqual("loss");
    expect(res.winningOdds).toEqual(null);
  });
  test("Testing totals -- should return a push", () => {
    const push: MatchupResult = {
      awayScore: 2,
      homeScore: 1,
      pointsTotal: 3,
      oddsType: "totals",
      drawEligible: false,
      drawTeam: "Austin FC",
      strAwayTeam: "Austin FC",
      strHomeTeam: "Houston Dynamo",
      pick: "under",
      odds: {
        overOdds: -115,
        underOdds: 115,
        total: 3,
      },
    };
    const res = getPickResult(push);
    expect(res.result).toEqual("push");
    expect(res.winningOdds).toEqual(null);
  });
});

// describe("getwinningOdds", () => {
//   test("returns the amount won on positive odds", () => {
//     const pointsWagered = 100;
//     expect(getwinningOdds(pointsWagered, 100)).toBe(100 + pointsWagered);
//     expect(getwinningOdds(pointsWagered, 115)).toBe(115 + pointsWagered);
//     expect(getwinningOdds(pointsWagered, 215)).toBe(215 + pointsWagered);
//     expect(getwinningOdds(pointsWagered, 1000)).toBe(1000 + pointsWagered);
//     expect(getwinningOdds(pointsWagered, 10000)).toBe(10000 + pointsWagered);
//   });
//   test("returns the amount won on negative odds", () => {
//     const pointsWagered = 100;
//     expect(getwinningOdds(pointsWagered, -100)).toBe(100 + pointsWagered);
//     expect(getwinningOdds(pointsWagered, -115)).toBe(186.96);
//     expect(getwinningOdds(pointsWagered, -150)).toBe(166.67);
//     expect(getwinningOdds(pointsWagered, -230)).toBe(143.48);
//     expect(getwinningOdds(pointsWagered, -1000)).toBe(110);
//     expect(getwinningOdds(pointsWagered, -10000)).toBe(101);
//   });
// });

describe("americanToDecimalOdds", () => {
  test("should convert american odds to decimal odds", () => {
    expect(americanToDecimalOdds(100)).toBe(2);
    expect(americanToDecimalOdds(110)).toBe(2.1);
    expect(americanToDecimalOdds(1000)).toBe(11);
    expect(americanToDecimalOdds(10000)).toBe(101);
    expect(americanToDecimalOdds(-110)).toBe(1.91);
    expect(americanToDecimalOdds(-350)).toBe(1.29);
    expect(americanToDecimalOdds(-1350)).toBe(1.07);
    expect(americanToDecimalOdds(-10000)).toBe(1.01);
  });
});

describe("decimalToAmericanOdds", () => {
  test("should convert decimal odds to american odds", () => {
    expect(decimalToAmericanOdds(2)).toBe(100);
    expect(decimalToAmericanOdds(2.25)).toBe(125);
    expect(decimalToAmericanOdds(2.5)).toBe(150);
    expect(decimalToAmericanOdds(11.5)).toBe(1050);

    expect(decimalToAmericanOdds(1.91)).toBe(-110);
    expect(decimalToAmericanOdds(1.87)).toBe(-115);
    expect(decimalToAmericanOdds(1.39)).toBe(-256);
    expect(decimalToAmericanOdds(1.1)).toBe(-1000);
    expect(decimalToAmericanOdds(1.01)).toBe(-10000);
  });
});

describe("getWinOrDrawOdds", () => {
  test("given one teams odds and the draw odds, it calculates the win or draw odds", () => {
    expect(getWinOrDrawOdds(-109, 257)).toBe(-400);
    expect(getWinOrDrawOdds(257, 400)).toBe(108);
    expect(getWinOrDrawOdds(-110, 220)).toBe(-500);
    expect(getWinOrDrawOdds(370, 295)).toBe(115);
  });
});

describe("calculateParlayPayout", () => {
  test("given one teams odds and the draw odds, it calculates the win or draw odds", () => {
    const BET_SIZE = 100;
    expect(calculateParlayPayout(BET_SIZE, [130, -150])).toBe(BET_SIZE + 284.1);
    expect(calculateParlayPayout(BET_SIZE, [150, 150])).toBe(BET_SIZE + 525);
    expect(calculateParlayPayout(BET_SIZE, [-110, -110])).toBe(BET_SIZE + 264.81);
    expect(calculateParlayPayout(BET_SIZE, [-10000, -155])).toBe(BET_SIZE + 66.65);
  });
});
