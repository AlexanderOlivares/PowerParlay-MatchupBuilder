import { OddsView } from "../interfaces/matchup";
import {
  WeightingModel,
  dayRangeLaTimezone,
  getLeagueWeightRanges,
  getValidGameOdds,
  matchGameRowByTeamNames,
  unreliableSportsbooks,
} from "../utils/matchupBuilderUtils";
import { gameRows } from "./fixtures/matchupBuilderFixtures";

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

describe("getValidGameOdds function", () => {
  const moneylineOddsView: OddsView[] = [
    {
      gameId: 279232,
      sportsbook: "fanduel", // fanduel and draftkings should be filtered out
      sportsbookId: null,
      viewType: "n/a",
      openingLine: {
        odds: null,
        homeOdds: -100,
        awayOdds: 150,
        overOdds: null,
        underOdds: null,
        drawOdds: 0,
        homeSpread: null,
        awaySpread: null,
        total: null,
      },
      currentLine: {
        odds: null,
        homeOdds: -100,
        awayOdds: 190,
        overOdds: null,
        underOdds: null,
        drawOdds: 0,
        homeSpread: null,
        awaySpread: null,
        total: null,
      },
      moneyLineHistory: null,
      spreadHistory: null,
      totalHistory: null,
    },
    {
      gameId: 279233,
      sportsbook: "betmgm",
      sportsbookId: null,
      viewType: "n/a",
      openingLine: {
        odds: null,
        homeOdds: -120,
        awayOdds: 100,
        overOdds: null,
        underOdds: null,
        drawOdds: 0,
        homeSpread: null,
        awaySpread: null,
        total: null,
      },
      currentLine: {
        odds: null,
        homeOdds: -120,
        awayOdds: 100,
        overOdds: null,
        underOdds: null,
        drawOdds: 0,
        homeSpread: null,
        awaySpread: null,
        total: null,
      },
      moneyLineHistory: null,
      spreadHistory: null,
      totalHistory: null,
    },
  ];
  it("should return a valid game odd when all mandatory fields are present", () => {
    const oddsType = "money-line";
    const result = getValidGameOdds(moneylineOddsView, oddsType);

    expect(result).toBeDefined();
    expect(result?.currentLine.homeOdds).toEqual(-120);
    expect(result?.currentLine.awayOdds).toEqual(100);
    expect(result?.currentLine.drawOdds).toEqual(0);
    expect(result?.currentLine.overOdds).toEqual(null);
    expect(result?.currentLine.underOdds).toEqual(null);
    expect(result?.currentLine.homeSpread).toEqual(null);
    expect(result?.currentLine.awaySpread).toEqual(null);
    expect(result?.currentLine.total).toEqual(null);
  });

  it("should return undefined when any mandatory field is missing", () => {
    const totals = getValidGameOdds(moneylineOddsView, "totals");
    const spread = getValidGameOdds(moneylineOddsView, "totals");
    expect(totals).toBeUndefined();
    expect(spread).toBeUndefined();
  });

  it("should return undefined when oddsType is not recognized", () => {
    // "pointspread" is the valid oddsType
    const result = getValidGameOdds(moneylineOddsView, "point-spread");
    expect(result).toBeUndefined();
  });

  it("should filter out fanduel and draftkings", () => {
    const result = getValidGameOdds(moneylineOddsView, "pointspread");
    expect(unreliableSportsbooks).not.toContain(result?.sportsbook);
    expect(unreliableSportsbooks).not.toContain(result?.sportsbook);
  });
});

describe("matchGameRowByTeamNames", () => {
  it("returns a gameRow when team names match exactly", async () => {
    const exactNames = matchGameRowByTeamNames(gameRows, "Chicago Cubs", "Colorado Rockies");
    expect(exactNames?.gameView.awayTeam.fullName).toEqual("Chicago Cubs");
    expect(exactNames?.gameView.homeTeam.fullName).toEqual("Colorado Rockies");
  });
  it("returns a gameRow when 1 provided team name is a partial match of the fullName", async () => {
    const partialNames = matchGameRowByTeamNames(gameRows, "Los Angeles Angels", "Seattle");
    expect(partialNames?.gameView.awayTeam.fullName).toEqual("Los Angeles Angels");
    expect(partialNames?.gameView.homeTeam.fullName).toEqual("Seattle Mariners");
  });
  it("returns a gameRow when both provided names are only a partial match of the fullName", async () => {
    const partialNames = matchGameRowByTeamNames(gameRows, "Angels", "Seattle");
    expect(partialNames?.gameView.awayTeam.fullName).toEqual("Los Angeles Angels");
    expect(partialNames?.gameView.homeTeam.fullName).toEqual("Seattle Mariners");
  });
  it("returns undefined when at least 1 team name is not a partial match", async () => {
    const partialNames = matchGameRowByTeamNames(gameRows, "Angels", "Zeattle");
    expect(partialNames?.gameView.awayTeam.fullName).toEqual(undefined);
    expect(partialNames?.gameView.homeTeam.fullName).toEqual(undefined);
  });
});
