import { test, expect } from "vitest";

import moment from "moment";
import {
  getWinner,
  gameTimeInPast,
  getMsToGameTime,
  getScoresAsNums,
  convertStringNumberToRealNumber,
} from "../utils/liveScoreQueueUtils";

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
