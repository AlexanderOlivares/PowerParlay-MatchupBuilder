import moment from "moment";
import { MandatoryOddsFields } from "./matchupBuilderUtils";
import { Odds, OddsView } from "../interfaces/matchup";
import { SOCCER_LEAGUES } from "./leagueMap.ts";
import logger from "../winstonLogger.ts";
import axios from "axios";
import Redis from "ioredis";

export function getOddsQueueDelay(strTimestamp: string): number {
  const now = moment();
  const future = moment(strTimestamp);

  const hours = future.diff(now, "hours");
  const minutes = future.diff(now, "minutes");

  // Delay time in milliseconds
  if (hours > 8) return 14400000; // 4 hours
  if (hours > 4) return 7200000; // 2 hours
  if (hours > 1) return 3600000; // 1 hour
  if (minutes > 30) return 1200000; // 20 minutes
  return 0; // back-off under 30 minutes
}

export function oddsWereUpdated(
  mandatoryOddsFields: MandatoryOddsFields,
  oddsType: string,
  gameOddsCurrentLine: OddsView["currentLine"],
  latestDbOdds: Odds
) {
  return mandatoryOddsFields[oddsType].some(
    odds => gameOddsCurrentLine[odds] !== latestDbOdds[odds]
  );
}

export function getOddsScopes(oddsType: string, idLeague: string, oddsScope = "full-game") {
  if (oddsType === "money-line" && SOCCER_LEAGUES.includes(idLeague)) {
    return "";
  }
  return `/${oddsType}/${oddsScope}`;
}

export async function getToken(redis: Redis, location: string) {
  const cached = await redis.get("token");
  if (cached) {
    logger.info({ message: "valid token" });
    return cached;
  }

  const { data } = await axios.get(`${process.env.LINES_TOKEN_REFRESH}`);
  const matches = data.match(/(?<=\"buildId":").{21}/i);
  if (!matches) {
    const message = "Null refresh token";
    logger.error({
      message,
      location,
    });
    throw new Error(message);
  }
  const token = matches[0];
  redis.set("token", token, "EX", 60 * 60); // cache for 1 hour
  return token;
}

export async function getCachedOdds(redis: Redis, endpointCacheKey: string, location: string) {
  const cached = await redis.get(endpointCacheKey);
  if (cached) {
    logger.info({ message: "odds returned from cache!", cacheKey: endpointCacheKey });
    return JSON.parse(cached);
  }

  const token = await getToken(redis, location);
  const { data } = await axios.get(
    `${process.env.LINES_BASE_URL}${token}${process.env.LINES_ENDPOINT}${endpointCacheKey}`
  );
  redis.set(endpointCacheKey, JSON.stringify(data), "EX", 60 * 30); // cache for 30 minutes

  return data;
}

export async function getFallbackScores(redis: Redis, endpointCacheKey: string, location: string) {
  const cached = await redis.get(endpointCacheKey);
  if (cached) {
    logger.info({ message: "fallback scores returned from cache!", cacheKey: endpointCacheKey });
    return JSON.parse(cached);
  }

  const token = await getToken(redis, location);
  const { data } = await axios.get(`${process.env.LINES_BASE_URL}${token}${endpointCacheKey}`);
  redis.set(endpointCacheKey, JSON.stringify(data), "EX", 60 * 5); // cache for 5 minutes

  return data;
}
