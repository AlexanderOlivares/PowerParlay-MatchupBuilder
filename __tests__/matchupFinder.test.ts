import axios from "axios";
import moment from "moment";
import "moment-timezone";
import {
  getUpcomingWeekDates,
  getWorkflowDayOffset,
  getWorkflowStartDate,
  promiseDotAll,
} from "../utils/matchupFinderUtils";

describe("getUpcomingWeekDates", () => {
  afterEach(() => {
    moment.now = () => Date.now();
  });

  const WEEK_LENGTH = 7;

  test("returns 7 dates", () => {
    const dates = getUpcomingWeekDates();

    expect(dates.length).toEqual(WEEK_LENGTH);
  });

  test("should start with a Tuesday and end with a Monday if current day is Sunday", () => {
    const sun = moment.tz("2023-02-26", "America/Los_Angeles");
    // Override now() to return mocked date
    moment.now = () => sun.valueOf();

    const dates = getUpcomingWeekDates();

    expect(dates[0]).toBe("20230228");
    expect(dates[6]).toBe("20230306");
  });

  test("dates are sequential starting Tuesday", () => {
    const sun = moment.tz("2023-02-26", "America/Los_Angeles");
    const sunTimestamp = sun.valueOf();
    moment.now = () => sunTimestamp;

    const dates = getUpcomingWeekDates();

    // Increment mock clock by 1 day
    moment.now = () => sunTimestamp + 24 * 60 * 60 * 1000;

    expect(dates).toEqual([
      "20230228",
      "20230301",
      "20230302",
      "20230303",
      "20230304",
      "20230305",
      "20230306",
    ]);
  });

  test("should work with only the startDate argument", () => {
    const sun = moment.tz("2023-02-26", "America/Los_Angeles");
    // Override now() to return mocked date
    moment.now = () => sun.valueOf();

    const dates = getUpcomingWeekDates(moment());

    expect(dates[0]).toBe("20230228");
    expect(dates[6]).toBe("20230306");
  });

  test("should work with only the dayOffset argument", () => {
    const sun = moment.tz("2023-02-26", "America/Los_Angeles");
    moment.now = () => sun.valueOf();

    const dates = getUpcomingWeekDates(undefined, 1);

    expect(dates[0]).toBe("20230227");
    expect(dates[6]).toBe("20230305");
  });

  test("should work with both arguments", () => {
    const sun = moment.tz("2023-02-26", "America/Los_Angeles");
    moment.now = () => sun.valueOf();

    const dates = getUpcomingWeekDates(moment(), 3);

    expect(dates[0]).toBe("20230301");
    expect(dates[6]).toBe("20230307");
  });
});

beforeEach(() => {
  vi.mock("axios");
  axios.get = vi.fn();
  (axios.get as any).mockReset();
});

describe("promiseDotAll", () => {
  it("makes requests for each date", async () => {
    const dates = ["2023-01-01", "2023-01-02"];
    const sport = "MLB";

    (axios.get as any).mockResolvedValue({ data: "mock data" });

    promiseDotAll(dates, sport);

    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(axios.get).toHaveBeenCalledWith(
      `${process.env.BASE_URL}${sport}?dates=2023-01-01&tz=${process.env.TZ}`
    );
    expect(axios.get).toHaveBeenCalledWith(
      `${process.env.BASE_URL}${sport}?dates=2023-01-02&tz=${process.env.TZ}`
    );
  });

  it("returns error object if axios request fails", async () => {
    (axios.get as any).mockRejectedValue(new Error("Network error"));

    const result = promiseDotAll(["2023-01-01"], "MLS");
    const promise = result[0];

    expect(axios.get).toHaveBeenCalledTimes(1);
    await expect(promise).resolves.toEqual({ error: true });
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
