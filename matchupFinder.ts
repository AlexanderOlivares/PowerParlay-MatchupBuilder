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
const upcomingWeekDates = Array.from({ length: WEEK_LENGTH }, (_, i) => {
  return moment().add(i, "days").format("YYYYMMDD");
});

function promiseDotAll(dates: string[], sport: string) {
  return dates.map(async date => {
    try {
      const { data } = await axios.get(`${BASE_URL}${sport}?dates=${date}&tz=${process.env.TZ}`);
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          console.log(axiosError.response.data);
          console.log(axiosError.response.status);
          console.log(axiosError.response.headers);
        } else if (axiosError.request) {
          console.log(axiosError.request);
        }
        console.log("Error:", axiosError.message);
      } else if (error instanceof Error) {
        console.error("Error:", error.message);
      } else {
        console.error("Unknown error occurred.");
      }
      return { error: true };
    }
  });
}

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
});

console.log(`${insertCount.count} potential matchups added`);

await prisma.$disconnect();
