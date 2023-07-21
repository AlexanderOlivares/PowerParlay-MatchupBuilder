import logger from "./winstonLogger.ts";
import { getUpcomingWeekDates } from "./matchupFinder.ts";

const upcomingWeekDates = getUpcomingWeekDates();

logger.info({ message: upcomingWeekDates });
