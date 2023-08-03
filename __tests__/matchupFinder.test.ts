import axios, { AxiosError } from "axios";
import moment from "moment";
import "moment-timezone";
import {
  getUpcomingWeekDates,
  getWorkflowDayOffset,
  getWorkflowStartDate,
  handleNetworkError,
  missingMandatoryFields,
} from "../utils/matchupFinderUtils";
import { leagueLookup } from "../utils/leagueMap";
import logger from "../winstonLogger";

describe("getUpcomingWeekDates", () => {
  afterEach(() => {
    moment.now = () => Date.now();
  });

  // Week is 8 days to capture the PM games on the 7th day that start "tomorrow" in UTC time
  const WEEK_LENGTH = 8;

  test("returns 8 dates", () => {
    const dates = getUpcomingWeekDates();

    expect(dates.length).toEqual(WEEK_LENGTH);
  });

  test("should start with a Tuesday and end with a Monday if current day is Sunday", () => {
    const sun = moment("2023-02-26");
    // Override now() to return mocked date
    moment.now = () => sun.valueOf();

    const dates = getUpcomingWeekDates(sun);

    expect(dates[0]).toBe("2023-02-28");
    expect(dates[6]).toBe("2023-03-06");
  });

  test("Should start with today if dayOffset is equal to 0", () => {
    const today = moment("2023-07-21");
    moment.now = () => today.valueOf();
    const dates = getUpcomingWeekDates(today, 0);

    expect(dates[0]).toBe("2023-07-21");
  });

  test("dates are sequential starting Tuesday", () => {
    const sun = moment("2023-02-26");
    const sunTimestamp = sun.valueOf();
    moment.now = () => sunTimestamp;

    const dates = getUpcomingWeekDates();

    // Increment mock clock by 1 day
    moment.now = () => sunTimestamp + 24 * 60 * 60 * 1000;

    expect(dates).toEqual([
      "2023-02-28",
      "2023-03-01",
      "2023-03-02",
      "2023-03-03",
      "2023-03-04",
      "2023-03-05",
      "2023-03-06",
      "2023-03-07",
    ]);
  });

  test("should work with only the startDate argument", () => {
    const sun = moment.tz("2023-02-26", "America/Los_Angeles");
    // Override now() to return mocked date
    moment.now = () => sun.valueOf();

    const dates = getUpcomingWeekDates(moment());

    expect(dates[0]).toBe("2023-02-28");
    expect(dates[6]).toBe("2023-03-06");
  });

  test("should work with only the dayOffset argument", () => {
    const sun = moment.tz("2023-02-26", "America/Los_Angeles");
    moment.now = () => sun.valueOf();

    const dates = getUpcomingWeekDates(undefined, 1);

    expect(dates[0]).toBe("2023-02-27");
    expect(dates[6]).toBe("2023-03-05");
  });

  test("should work with both arguments", () => {
    const sun = moment.tz("2023-02-26", "America/Los_Angeles");
    moment.now = () => sun.valueOf();

    const dates = getUpcomingWeekDates(moment(), 3);

    expect(dates[0]).toBe("2023-03-01");
    expect(dates[6]).toBe("2023-03-07");
  });
});

beforeEach(() => {
  vi.mock("axios");
  axios.get = vi.fn();
  (axios.get as any).mockReset();
  vi.spyOn(logger, "error");
  vi.spyOn(logger, "warn");
});

describe("handleNetworkError", () => {
  it("returns generic error object if axios request fails", async () => {
    (axios.get as any).mockRejectedValue(new Error("Network error"));

    expect(handleNetworkError(axios.get)).toEqual({ genericError: true });
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledOnce();
  });
});

describe("customOffsetHandler", () => {
  it("Returns offset number if provided or default to 2 for scheduled sunday offset", async () => {
    expect(getWorkflowDayOffset("0")).toBe(0);
    expect(getWorkflowDayOffset("1")).toBe(1);
    expect(getWorkflowDayOffset("2")).toBe(2);

    expect(getWorkflowDayOffset(undefined)).toBe(2);
    expect(getWorkflowDayOffset("")).toBe(2);
  });
});

describe("customDateHandler", () => {
  it("returns current date if no argument", () => {
    const result = getWorkflowStartDate();
    const undef = getWorkflowStartDate(undefined);

    expect(result.format("YYYY-MM-DD")).toEqual(moment().format("YYYY-MM-DD"));
    expect(undef.format("YYYY-MM-DD")).toEqual(moment().format("YYYY-MM-DD"));
  });

  it("returns current date if argument is empty string", () => {
    const empty = getWorkflowStartDate("");

    expect(empty.format("YYYY-MM-DD")).toEqual(moment().format("YYYY-MM-DD"));
  });

  it("parses date string if provided", () => {
    const input = "2023-07-22";
    const result = getWorkflowStartDate(input);

    expect(result.format("YYYY-MM-DD")).toEqual(input);
  });

  it("returns moment object", () => {
    const undef = getWorkflowStartDate();
    const empty = getWorkflowStartDate("");
    const proper = getWorkflowStartDate("2023-07-22");

    expect(undef).toBeInstanceOf(moment);
    expect(empty).toBeInstanceOf(moment);
    expect(proper).toBeInstanceOf(moment);
  });
});

describe("missingMandatoryFields", () => {
  it("returns true if at least 1 mandatory field is missing", async () => {
    const mandatoryExist = {
      1: "hi",
      2: "hi",
      3: "hi",
    };
    expect(missingMandatoryFields(["1", "2", "3"], mandatoryExist)).toBe(false);
  });
  it("returns false if at least 1 mandatory field is null", async () => {
    const mandatoryExistButNullish = {
      1: null,
      2: "hi",
      3: "hi",
    };
    expect(missingMandatoryFields(["1", "2", "3"], mandatoryExistButNullish)).toBe(true);
  });
  it("returns false if at least 1 mandatory field is empty string", async () => {
    const mandatoryExistButEmptyString = {
      1: "",
      2: "hi",
      3: "hi",
    };
    expect(missingMandatoryFields(["1", "2", "3"], mandatoryExistButEmptyString)).toBe(true);
  });
  it("returns false if at least 1 mandatory field is undefined", async () => {
    const mandatoryExistButEmptyString = {
      2: "hi",
      3: "hi",
    };
    expect(missingMandatoryFields(["1", "2", "3"], mandatoryExistButEmptyString)).toBe(true);
  });
});
