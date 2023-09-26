import { test, expect } from "vitest";

import moment from "moment";
import {
  getWinner,
  gameTimeInPast,
  getMsToGameTime,
  getScoresAsNums,
  convertStringNumberToRealNumber,
  getLiveScoreQueueDelay,
  getPickResult,
  getPointsAwarded,
  americanToDecimalOdds,
  decimalToAmericanOdds,
  getWinOrDrawOdds,
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

describe("getLiveScoreQueueDelay", () => {
  test("returns the amount of ms in the future the gameTime is plus a 5 second added buffer", () => {
    const inThreeHour = moment.utc().subtract(3, "hour");
    const inTwoHour = moment.utc().subtract(2, "hour");
    const inFiftyNineMins = moment.utc().subtract(59, "minute");
    expect(getLiveScoreQueueDelay(inThreeHour.toISOString())).toBe(180000);
    expect(getLiveScoreQueueDelay(inTwoHour.toISOString())).toBe(600000);
    expect(getLiveScoreQueueDelay(inFiftyNineMins.toISOString())).toBe(1800000);
  });
});

// describe("getPickResult", () => {
//   test("Testing pointspread -- should return win when an away team favorite covers spread and pick is away team", () => {
//     const awayTeamCoverCorrectPick: MatchupResult = {
//       awayScore: 10,
//       homeScore: 3,
//       pointsTotal: 13,
//       oddsType: "pointspread",
//       drawEligible: false,
//       drawTeam: null,
//       strAwayTeam: "Cowboys",
//       strHomeTeam: "Cardinals",
//       pick: "Cowboys",
//       odds: {
//         homeOdds: -140,
//         awayOdds: 115,
//         homeSpread: 3,
//         awaySpread: -3,
//       },
//     };
//     expect(getPickResult(awayTeamCoverCorrectPick)).toBe("win");
//   });
//   test("Testing pointspread -- should return loss when an away team favorite covers spread and pick is home team", () => {
//     const awayTeamCoverIncorrectPick: MatchupResult = {
//       awayScore: 10,
//       homeScore: 3,
//       pointsTotal: 13,
//       oddsType: "pointspread",
//       drawEligible: false,
//       drawTeam: null,
//       strAwayTeam: "Cowboys",
//       strHomeTeam: "Cardinals",
//       pick: "Cardinals",
//       odds: {
//         homeOdds: -140,
//         awayOdds: 115,
//         homeSpread: 3,
//         awaySpread: -3,
//       },
//     };
//     expect(getPickResult(awayTeamCoverIncorrectPick)).toBe("loss");
//   });
//   test("Testing pointspread -- should return win when away team does not cover spread and pick is home team", () => {
//     const awayTeamNotCoverCorrectPick: MatchupResult = {
//       awayScore: 10,
//       homeScore: 9,
//       pointsTotal: 13,
//       oddsType: "pointspread",
//       drawEligible: false,
//       drawTeam: null,
//       strAwayTeam: "Cowboys",
//       strHomeTeam: "Cardinals",
//       pick: "Cardinals",
//       odds: {
//         homeOdds: -140,
//         awayOdds: 115,
//         homeSpread: 3,
//         awaySpread: -3,
//       },
//     };
//     expect(getPickResult(awayTeamNotCoverCorrectPick)).toBe("win");
//   });
//   test("Testing pointspread -- should return loss when away team does not cover spread and pick is away team", () => {
//     const awayTeamNotCoverIncorrectPick: MatchupResult = {
//       awayScore: 10,
//       homeScore: 9,
//       pointsTotal: 13,
//       oddsType: "pointspread",
//       drawEligible: false,
//       drawTeam: null,
//       strAwayTeam: "Cowboys",
//       strHomeTeam: "Cardinals",
//       pick: "Cowboys",
//       odds: {
//         homeOdds: -140,
//         awayOdds: 115,
//         homeSpread: 3,
//         awaySpread: -3,
//       },
//     };
//     expect(getPickResult(awayTeamNotCoverIncorrectPick)).toBe("loss");
//   });
//   /////
//   test("Testing pointspread -- should return win when a home team favorite covers spread and pick is home team", () => {
//     const homeTeamCoverCorrectPick: MatchupResult = {
//       awayScore: 6,
//       homeScore: 10,
//       pointsTotal: 16,
//       oddsType: "pointspread",
//       drawEligible: false,
//       drawTeam: null,
//       strAwayTeam: "Cowboys",
//       strHomeTeam: "Cardinals",
//       pick: "Cardinals",
//       odds: {
//         homeOdds: -140,
//         awayOdds: 115,
//         homeSpread: -3,
//         awaySpread: 3,
//       },
//     };
//     expect(getPickResult(homeTeamCoverCorrectPick)).toBe("win");
//   });
//   test("Testing pointspread -- should return loss when an home team favorite covers spread and pick is away team", () => {
//     const homeTeamCoverIncorrectPick: MatchupResult = {
//       awayScore: 6,
//       homeScore: 10,
//       pointsTotal: 16,
//       oddsType: "pointspread",
//       drawEligible: false,
//       drawTeam: null,
//       strAwayTeam: "Cowboys",
//       strHomeTeam: "Cardinals",
//       pick: "Cowboys",
//       odds: {
//         homeOdds: -140,
//         awayOdds: 115,
//         homeSpread: -3,
//         awaySpread: 3,
//       },
//     };
//     expect(getPickResult(homeTeamCoverIncorrectPick)).toBe("loss");
//   });
//   test("Testing pointspread -- should return win when home team favorite does not cover spread and pick is away team", () => {
//     const homeTeamNotCoverCorrectPick: MatchupResult = {
//       awayScore: 9,
//       homeScore: 10,
//       pointsTotal: 19,
//       oddsType: "pointspread",
//       drawEligible: false,
//       drawTeam: null,
//       strAwayTeam: "Cowboys",
//       strHomeTeam: "Cardinals",
//       pick: "Cowboys",
//       odds: {
//         homeOdds: -140,
//         awayOdds: 115,
//         homeSpread: -3,
//         awaySpread: 3,
//       },
//     };
//     expect(getPickResult(homeTeamNotCoverCorrectPick)).toBe("win");
//   });
//   test("Testing pointspread -- should return loss when home team favorite does not cover spread and pick is home team", () => {
//     const homeTeamNotCoverIncorrectPick: MatchupResult = {
//       awayScore: 9,
//       homeScore: 10,
//       pointsTotal: 19,
//       oddsType: "pointspread",
//       drawEligible: false,
//       drawTeam: null,
//       strAwayTeam: "Cowboys",
//       strHomeTeam: "Cardinals",
//       pick: "Cardinals",
//       odds: {
//         homeOdds: -140,
//         awayOdds: 115,
//         homeSpread: -3,
//         awaySpread: 3,
//       },
//     };
//     expect(getPickResult(homeTeamNotCoverIncorrectPick)).toBe("loss");
//   });
//   test("Testing pointspread -- should return push when spread is a whole number and away favorite team wins by exactly that amount", () => {
//     const homeTeamNotCoverIncorrectPick: MatchupResult = {
//       awayScore: 21,
//       homeScore: 14,
//       pointsTotal: 35,
//       oddsType: "pointspread",
//       drawEligible: false,
//       drawTeam: null,
//       strAwayTeam: "Cowboys",
//       strHomeTeam: "Cardinals",
//       pick: "Cowboys",
//       odds: {
//         homeOdds: -140,
//         awayOdds: 115,
//         homeSpread: 7,
//         awaySpread: -7,
//       },
//     };
//     expect(getPickResult(homeTeamNotCoverIncorrectPick)).toBe("push");
//   });
//   test("Testing pointspread -- should return push when spread is a whole number and hoe favorite team wins by exactly that amount", () => {
//     const homeTeamNotCoverIncorrectPick: MatchupResult = {
//       awayScore: 7,
//       homeScore: 14,
//       pointsTotal: 35,
//       oddsType: "pointspread",
//       drawEligible: false,
//       drawTeam: null,
//       strAwayTeam: "Cowboys",
//       strHomeTeam: "Cardinals",
//       pick: "Cowboys",
//       odds: {
//         homeOdds: -140,
//         awayOdds: 115,
//         homeSpread: -7,
//         awaySpread: 7,
//       },
//     };
//     expect(getPickResult(homeTeamNotCoverIncorrectPick)).toBe("push");
//   });
//   test("Testing pointspread -- should return push when spread is 0 and game ends in a draw", () => {
//     const homeTeamNotCoverIncorrectPick: MatchupResult = {
//       awayScore: 9,
//       homeScore: 9,
//       pointsTotal: 18,
//       oddsType: "pointspread",
//       drawEligible: false,
//       drawTeam: null,
//       strAwayTeam: "Cowboys",
//       strHomeTeam: "Cardinals",
//       pick: "Cardinals",
//       odds: {
//         homeOdds: -140,
//         awayOdds: 115,
//         homeSpread: 0,
//         awaySpread: 0,
//       },
//     };
//     expect(getPickResult(homeTeamNotCoverIncorrectPick)).toBe("push");
//   });
// });

describe("getPointsAwarded", () => {
  test("returns the amount won on positive odds", () => {
    const tomorrow = moment.utc().add(1, "day");
    expect(getPointsAwarded(100)).toBe(100);
    expect(getPointsAwarded(115)).toBe(115);
    expect(getPointsAwarded(215)).toBe(215);
    expect(getPointsAwarded(1000)).toBe(1000);
    expect(getPointsAwarded(10000)).toBe(10000);
  });
  test("returns the amount won on negative odds", () => {
    const tomorrow = moment.utc().add(1, "day");
    expect(getPointsAwarded(-100)).toBe(100);
    expect(getPointsAwarded(-115)).toBe(86.96);
    expect(getPointsAwarded(-150)).toBe(66.67);
    expect(getPointsAwarded(-230)).toBe(43.48);
    expect(getPointsAwarded(-1000)).toBe(10);
    expect(getPointsAwarded(-10000)).toBe(1);
  });
});

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
