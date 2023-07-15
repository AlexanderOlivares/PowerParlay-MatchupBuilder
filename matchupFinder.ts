import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import moment from "moment";
import "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const BASE_URL = process.env.BASE_URL;
const MLB = process.env.MLB as string;
const MLS = process.env.MLS as string;

const WEEK_LENGTH = 7;
const SUNDAY_CRON_OFFSET = 2;

/*
This script is designed to run on Sun to capture games for the upcoming Tue - Mon. 
Added optional params with defaults for future schedule flexibility 
*/
export function getUpcomingWeekDates(
  startDate: moment.Moment = moment(),
  dayOffset: number = SUNDAY_CRON_OFFSET
) {
  return Array.from({ length: WEEK_LENGTH }, (_, i) => {
    return moment(startDate)
      .tz("America/Los_Angeles")
      .add(i + dayOffset, "days")
      .format("YYYYMMDD");
  });
}

export function promiseDotAll(dates: string[], sport: string) {
  return dates.map(async date => {
    try {
      const { data } = await axios.get(`${BASE_URL}${sport}?dates=${date}&tz=${process.env.TZ}`);
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          console.error(axiosError.response.data);
          console.error(axiosError.response.status);
          console.error(axiosError.response.headers);
        } else if (axiosError.request) {
          console.error(axiosError.request);
        }
        console.error("Error:", axiosError.message);
      } else if (error instanceof Error) {
        console.error("Error:", error.message);
      } else {
        console.error("Unknown error occurred.");
      }
      return { error: true };
    }
  });
}

const upcomingWeekDates = getUpcomingWeekDates();

const buildSportRequests = [MLB, MLS].flatMap(sport => {
  return promiseDotAll(upcomingWeekDates, sport);
});

const sportsData = await Promise.all(buildSportRequests);

// TODO update with other soccer leagues
function isDrawEligible(league: string) {
  return ["MLS"].includes(league);
}

interface IPotentialMatchup {
  id: string;
  eventId: string;
  gameDate: string;
  gameTime: string;
  name: string;
  league: string;
  gameStatus: string;
  drawEligible: boolean;
}

const formattedMatchups: IPotentialMatchup[] = [];

for (const sport of sportsData) {
  if (sport.error) continue;

  const league = sport?.leagues?.[0].abbreviation ?? "";
  const events = sport?.events ?? [];
  if (!league || !events.length) continue;

  for (const event of sport.events) {
    // make sure event falls within the valid week window
    const gameDate = moment.utc(event.date).tz("America/Los_Angeles").format("YYYYMMDD");
    if (!upcomingWeekDates.includes(gameDate)) continue;

    const { name: gameStatus } = event.status.type;
    if (gameStatus !== "STATUS_SCHEDULED") continue;

    const matchup: IPotentialMatchup = {
      id: uuidv4(),
      eventId: event.id,
      gameTime: event.date,
      name: event.name,
      gameDate,
      league,
      gameStatus,
      drawEligible: isDrawEligible(league),
    };

    formattedMatchups.push(matchup);
  }
}

const insertCount = await prisma.potentialMatchup.createMany({
  data: formattedMatchups,
  skipDuplicates: true,
});

console.log(`${insertCount.count} potential matchups added`);

await prisma.$disconnect();
