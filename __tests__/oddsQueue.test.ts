import { Odds } from "../interfaces/matchup";
import { mandatoryOddsFields } from "../utils/matchupBuilderUtils";
import { oddsWereUpdated } from "../utils/oddsQueueUtils";

describe("oddsWereUpdated", () => {
  it("detects money-line odds updates", async () => {
    const latestDbOdds: Odds = {
      id: "ad3bcbf8-037f-43c6-a13e-906dc7a3358b",
      matchupId: "e3aea48c-ce41-4f24-bde3-8c8c179bd84f",
      oddsGameId: 280813,
      sportsbook: "betmgm",
      homeOdds: -140,
      awayOdds: 115,
      drawOdds: 0,
      overOdds: null,
      underOdds: null,
      homeSpread: null,
      awaySpread: null,
      total: null,
      createdAt: new Date("2023-08-18T03:54:04.563Z"),
    };
    const changedLine = {
      odds: null,
      homeOdds: -155,
      awayOdds: 115,
      overOdds: null,
      underOdds: null,
      drawOdds: 0,
      homeSpread: null,
      awaySpread: null,
      total: null,
    };
    const sameLine = {
      odds: null,
      homeOdds: -140,
      awayOdds: 115,
      drawOdds: 0,
      overOdds: null,
      underOdds: null,
      homeSpread: null,
      awaySpread: null,
      total: null,
    };
    expect(oddsWereUpdated(mandatoryOddsFields, "money-line", changedLine, latestDbOdds)).toEqual(
      true
    );
    expect(oddsWereUpdated(mandatoryOddsFields, "money-line", sameLine, latestDbOdds)).toEqual(
      false
    );
  });
  it("detects pointspread odds updates", async () => {
    const latestDbOdds: Odds = {
      id: "ad3bcbf8-037f-43c6-a13e-906dc7a3358b",
      matchupId: "e3aea48c-ce41-4f24-bde3-8c8c179bd84f",
      oddsGameId: 280813,
      sportsbook: "betmgm",
      homeOdds: -110,
      awayOdds: -110,
      overOdds: null,
      underOdds: null,
      drawOdds: null,
      homeSpread: -8.5,
      awaySpread: 8.5,
      total: null,
      cratedAt: new Date("2023-08-18T03:54:04.563Z"),
    };
    const changedLine = {
      odds: null,
      homeOdds: -117,
      awayOdds: -110,
      overOdds: null,
      underOdds: null,
      drawOdds: null,
      homeSpread: -8.5,
      awaySpread: 8.5,
      total: null,
    };
    const sameLine = {
      odds: null,
      homeOdds: -110,
      awayOdds: -110,
      overOdds: null,
      underOdds: null,
      drawOdds: null,
      homeSpread: -8.5,
      awaySpread: 8.5,
      total: null,
    };
    expect(oddsWereUpdated(mandatoryOddsFields, "pointspread", changedLine, latestDbOdds)).toEqual(
      true
    );
    expect(oddsWereUpdated(mandatoryOddsFields, "pointspread", sameLine, latestDbOdds)).toEqual(
      false
    );
  });
  it("detects totals odds updates", async () => {
    const latestDbOdds: Odds = {
      id: "ad3bcbf8-037f-43c6-a13e-906dc7a3358b",
      matchupId: "e3aea48c-ce41-4f24-bde3-8c8c179bd84f",
      oddsGameId: 280813,
      sportsbook: "betmgm",
      homeOdds: null,
      awayOdds: null,
      overOdds: -115,
      underOdds: -105,
      drawOdds: null,
      homeSpread: null,
      awaySpread: null,
      total: 159.5,
      createdAt: new Date("2023-08-18T03:54:04.563Z"),
    };
    const changedLine = {
      odds: null,
      homeOdds: null,
      awayOdds: null,
      overOdds: -115,
      underOdds: -105,
      drawOdds: null,
      homeSpread: null,
      awaySpread: null,
      total: 159.0,
    };
    const sameLine = {
      odds: null,
      homeOdds: null,
      awayOdds: null,
      overOdds: -115,
      underOdds: -105,
      drawOdds: null,
      homeSpread: null,
      awaySpread: null,
      total: 159.5,
    };
    expect(oddsWereUpdated(mandatoryOddsFields, "totals", changedLine, latestDbOdds)).toEqual(true);
    expect(oddsWereUpdated(mandatoryOddsFields, "totals", sameLine, latestDbOdds)).toEqual(false);
  });
});
