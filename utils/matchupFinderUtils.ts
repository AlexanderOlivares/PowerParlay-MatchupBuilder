import axios, { AxiosError } from "axios";
import moment from "moment";
import "moment-timezone";
import logger from "../winstonLogger.ts";
import { GenericError } from "../interfaces/matchup.ts";

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
  // Week is 8 days to capture the PM games on the 7th day that start "tomorrow" in UTC time
  const WEEK_LENGTH = 8;
  return Array.from({ length: WEEK_LENGTH }, (_, i) => {
    return moment(startDate)
      .add(i + dayOffset, "days")
      .format("YYYY-MM-DD");
  });
}

export function makeIsoIfUnixTimestamp(strTimestamp: string) {
  const unixRegex = /^[0-9]{10}$/;
  if (!unixRegex.test(strTimestamp)) return strTimestamp;
  return moment.unix(parseInt(strTimestamp, 10)).toISOString();
}

interface TargetObject {
  [key: string]: any;
}

export function missingMandatoryFields(mandatoryFields: string[], target: TargetObject) {
  return mandatoryFields.some((field: keyof TargetObject) => {
    const falsyField = !Boolean(target[field]);
    if (falsyField) {
      logger.warn({ message: "Missing mandatory fields", missingField: field });
    }
    return falsyField;
  });
}

export function handleNetworkError(error: any): GenericError {
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
  logger.warn({ message: "Error caught and returned { genericError: true }", error });
  return { genericError: true };
}
