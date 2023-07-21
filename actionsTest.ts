import { getUpcomingWeekDates } from "./utils/matchupFinderUtils.ts";
import logger from "./winstonLogger.ts";

const upcomingWeekDates = getUpcomingWeekDates();

logger.info({ message: upcomingWeekDates });
