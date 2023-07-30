import {
  StartEnd,
  WeightingModel,
  dayRangeLaTimezone,
  getLeagueWeightRanges,
} from "../utils/matchupBuilderUtils";

describe("dayRangeLaTimezone", () => {
  it("Returns a UTC date range from midnight to next day LA time", async () => {
    expect(dayRangeLaTimezone("2023-07-27")).toStrictEqual({
      gte: "2023-07-27T07:00:00.000Z",
      lt: "2023-07-28T06:59:59.999Z",
    });
  });
});

describe("getLeagueWeightRanges", () => {
  const weightingModel: WeightingModel = {
    "4424": 0.7, // mlb-baseball
    "4346": 0.1, // major-league-soccer
    "4516": 0.2, // wnba-basketball
  };
  it("Returns a range of weightings (decimal numbers) for each league with games today", async () => {
    const leaguesWithGamesToday = ["4424", "4346", "4516"];
    const weightRangeMap = getLeagueWeightRanges(leaguesWithGamesToday, weightingModel);
    const sumOfRanges = [...weightRangeMap.values()].reduce((a, c) => a + (c.end - c.start), 0);

    expect(weightRangeMap.size).toEqual(3);
    expect(weightRangeMap.get("4424")).toEqual({ start: 0.3, end: 1 });
    expect(weightRangeMap.get("4346")?.start).toEqual(0);
    expect(weightRangeMap.get("4424")?.end).toEqual(1);
    expect(sumOfRanges).toEqual(1);
  });
  it("Returns normalized weightings for only leagues with games today", async () => {
    const noMLB = ["4346", "4516"];
    const noMLBWeights = getLeagueWeightRanges(noMLB, weightingModel);
    const sumOfRanges = [...noMLBWeights.values()].reduce((a, c) => a + (c.end - c.start), 0);

    expect(noMLBWeights.size).toEqual(2);
    expect(noMLBWeights.get("4346")).toEqual({ start: 0, end: 0.333 });
    expect(noMLBWeights.get("4516")).toEqual({ start: 0.333, end: 1 });
    expect(sumOfRanges).toEqual(1);

    const noWNBA = ["4424", "4346"];
    const noWNBAWeights = getLeagueWeightRanges(noWNBA, weightingModel);
    const noWNBARangeSum = [...noWNBAWeights.values()].reduce((a, c) => a + (c.end - c.start), 0);

    expect(noWNBAWeights.size).toEqual(2);
    expect(noWNBAWeights.get("4424")).toEqual({ start: 0.125, end: 1 });
    expect(noWNBAWeights.get("4346")).toEqual({ start: 0, end: 0.125 });
    expect(noWNBARangeSum).toEqual(1);
  });
  it("Returns normalized weightings for only leagues with games today", async () => {
    const complexWeightingModel = {
      "4424": 0.3, // active
      "4346": 0.05, // active
      "4335": 0.24, // active
      "4331": 0.12, // active
      // .71 total active
      "4328": 0.1,
      "4334": 0.11,
      "4332": 0.08,
    };

    const leagues = ["4346", "4424", "4335", "4331"];
    const weightRange = getLeagueWeightRanges(leagues, complexWeightingModel);
    const sumOfRanges = [...weightRange.values()].reduce((a, c) => a + (c.end - c.start), 0);

    expect(weightRange.size).toEqual(4);
    expect(weightRange.get("4424")).toEqual({ start: 0.577, end: 1 });
    expect(weightRange.get("4335")).toEqual({ start: 0.239, end: 0.577 });
    expect(sumOfRanges).toEqual(1);
  });
});
