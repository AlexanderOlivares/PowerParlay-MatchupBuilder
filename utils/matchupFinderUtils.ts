import axios, { AxiosError } from "axios";
import moment from "moment";
import "moment-timezone";
import logger from "../winstonLogger.ts";

const BASE_URL = process.env.BASE_URL;
const TZ = process.env.TZ;
const WORKFLOW_DAY_OFFSET = process.env.DAY_OFFSET;
const WORKFLOW_START_DATE = process.env.START_DATE;

export function getWorkflowStartDate(dateString?: string) {
  if (!dateString) return moment();
  return moment(dateString);
}

export function getWorkflowDayOffset(numberAsString?: string) {
  const SUNDAY_CRON_OFFSET = 2;
  if (!numberAsString) return SUNDAY_CRON_OFFSET;
  return Number(numberAsString) ?? SUNDAY_CRON_OFFSET;
}

/*
This script is designed to run on Sun to capture games for the upcoming Tue - Mon. 
Optional params can be manually added in the github workflow_dispatch inputs
*/
export function getUpcomingWeekDates(
  startDate: moment.Moment = getWorkflowStartDate(WORKFLOW_START_DATE),
  dayOffset: number = getWorkflowDayOffset(WORKFLOW_DAY_OFFSET)
) {
  const WEEK_LENGTH = 7;
  return Array.from({ length: WEEK_LENGTH }, (_, i) => {
    return moment(startDate)
      .add(i + dayOffset, "days")
      .format("YYYYMMDD");
  });
}

export function promiseDotAll(dates: string[], sport: string) {
  return dates.map(async date => {
    try {
      const { data } = await axios.get(`${BASE_URL}${sport}?dates=${date}&tz=${TZ}`);
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          logger.error({ message: axiosError.response });
        } else if (axiosError.request) {
          logger.error({ message: axiosError.request });
        } else {
          logger.error({ message: axiosError });
        }
      } else if (error instanceof Error) {
        logger.error({ message: error.message });
      } else {
        logger.error({ unknownError: true, message: error });
      }
      logger.warn({ message: "Error caught and returned { error: true }" });
      return { error: true };
    }
  });
}
