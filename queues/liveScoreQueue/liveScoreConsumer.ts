import Queue from "bull";
import dotenv from "dotenv";
import { EventData, Matchup } from "../../interfaces/matchup.ts";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import logger from "../../winstonLogger.ts";
import { MATCHUP_STATUSES, leagueLookup } from "../../utils/leagueMap.ts";
import "moment-timezone";
import { handleNetworkError } from "../../utils/matchupFinderUtils.ts";
import {
  calculateParlayPayout,
  gameTimeInPast,
  getLiveScoreQueueDelay,
  getMsToGameTime,
  getPickResult,
  getPointsAwarded,
  getScoresAsNums,
  getSelectFieldsForOddsType,
} from "../../utils/liveScoreQueueUtils.ts";
import { isOddsType } from "../../utils/matchupBuilderUtils.ts";
import { MatchupResult, OddsBasedOnOddsType, PickAndOddsId } from "../../interfaces/queue.ts";

dotenv.config({ path: "../../.env" });

const queue = new Queue("liveScore", process.env.REDIS_HOST!);
const prisma = new PrismaClient();

const location = "liveScoreConsumer";

// TODO fix any type
queue.process(async (job: any) => {
  logger.info({ message: "liveScore queue processing", data: job.data });

  const { id } = job.data;

  // @ts-ignore
  const matchup: Matchup | null = await prisma.matchups.findUnique({
    where: {
      id,
      used: true,
    },
  });

  if (!matchup) {
    throw new Error("matchup not found in db");
  }

  const {
    idEvent,
    idLeague,
    strTimestamp,
    locked,
    oddsType,
    drawEligible,
    drawTeam,
    strAwayTeam,
    strHomeTeam,
  } = matchup;

  if (!isOddsType(oddsType)) {
    throw new Error("Invalid oddsType");
  }

  if (!locked) {
    const gameStarted = gameTimeInPast(strTimestamp);
    if (gameStarted) {
      logger.info({
        message: "Begin matchup start tx to lock matchup/picks/parlays",
        location,
        matchupId: id,
      });
      await prisma.$transaction(async tx => {
        await tx.matchups.update({
          where: { id },
          data: {
            locked: true,
            status: "IP",
          },
        });

        await tx.pick.updateMany({
          where: { matchupId: id },
          data: {
            locked: true,
          },
        });

        const picks = await tx.pick.findMany({
          where: { matchupId: id },
          select: { parlayId: true },
        });

        await tx.parlay.updateMany({
          where: { id: { in: picks.map(({ parlayId }) => parlayId) } },
          data: {
            locked: true,
          },
        });
      });
      logger.info({
        message:
          "Success -- completed matchup start tx. Matchup/picks/parlays updated to locked and IP",
        location,
        matchupId: id,
      });
    } else {
      const delay = getMsToGameTime(strTimestamp);
      await queue.add(
        { id, delayToGameTime: delay },
        {
          delay,
          attempts: 3,
          removeOnComplete: {
            age: 604800, // keep up to 1 week (in seconds)
            count: 1000, // keep up to 1000 jobs
          },
          backoff: {
            type: "fixed",
            delay: 180000, // 3 minutes
          },
        }
      );
      logger.info({
        message: "GameTime in future. Adding back to liveScoreQueue",
        location,
        matchupId: id,
      });
      job.finished();
      return id;
    }
  }

  const league = leagueLookup[idLeague];

  let eventResponse;

  try {
    const { data } = await axios.get(
      `${process.env.SPORTS_BASE_URL}/lookupevent.php?id=${idEvent}`
    );
    eventResponse = data;
  } catch (error) {
    handleNetworkError(error);
    throw new Error("LiveScore API request failed");
  }

  const event: EventData[] | string | null = eventResponse.events;

  if (!Array.isArray(event)) {
    const message = "Error in event response";
    logger.error({
      message,
      location,
      anomalyData: { matchupId: id, idEvent, idLeague },
    });
    throw new Error(message);
  }

  const { intHomeScore, intAwayScore, strStatus } = event[0];

  if (MATCHUP_STATUSES.shouldPush.includes(strStatus)) {
    await prisma.matchups.update({
      where: {
        id,
      },
      data: {
        status: "FT",
        locked: false,
        adminUnlocked: true,
        awayScore: 0,
        homeScore: 0,
        pointsTotal: 0,
      },
    });
    logger.warn({
      message: "Game is postponed. Unlocking and setting scores to 0",
      location,
      anomalyData: { matchupId: id, strStatus },
    });
    job.finished();
    return id;
  }

  // There is a lag period between the game start time and when the API marks it as IP
  if (MATCHUP_STATUSES.notStarted.includes(strStatus)) {
    await queue.add(
      { id },
      {
        delay: 60000, // 1 minute
        attempts: 3,
        removeOnComplete: {
          age: 604800, // keep up to 1 week (in seconds)
          count: 1000, // keep up to 1000 jobs
        },
        backoff: {
          type: "fixed",
          delay: 180000, // 3 minutes
        },
      }
    );
    logger.warn({
      message: "Game time in past but 'NS' status from API. Adding back to liveScoreQueue",
      location,
      anomalyData: { matchupId: id, strStatus, gameTime: strTimestamp },
    });
    job.finished();
    return id;
  }

  if ([intHomeScore, intAwayScore, strStatus].some(field => !field)) {
    const message = "missing mandatory field in event response";
    logger.error({
      message,
      location,
      anomalyData: { matchupId: id, league, intHomeScore, intAwayScore, strStatus },
    });
    throw new Error(message);
  }

  if (MATCHUP_STATUSES.gameFinished.includes(strStatus)) {
    // @ts-ignore already checking for falsy fields in .some func above
    const { awayScore, homeScore } = getScoresAsNums(intAwayScore, intHomeScore);
    const pointsTotal = homeScore + awayScore;

    logger.info({
      message: "Begin matchup finished tx to unlock matchup/picks",
      matchupId: id,
      strStatus,
      location,
    });
    await prisma.$transaction(async tx => {
      await tx.matchups.update({
        where: { id },
        data: {
          status: "FT",
          locked: false,
          awayScore,
          homeScore,
          pointsTotal,
        },
      });

      const picks = await tx.pick.findMany({
        where: { matchupId: id },
        select: {
          id: true,
          oddsId: true,
          pick: true,
          parlayId: true,
        },
      });

      const select = getSelectFieldsForOddsType(oddsType);
      const cachedOdds = new Map<string, OddsBasedOnOddsType>();
      const parlayIdsToUpdate = new Set<string>();

      for (const { id, oddsId, pick, parlayId } of picks) {
        parlayIdsToUpdate.add(parlayId);

        let odds: OddsBasedOnOddsType;
        if (cachedOdds.has(oddsId)) {
          odds = cachedOdds.get(oddsId)!;
        } else {
          const oddsFound = (await tx.odds.findUnique({
            where: { id: oddsId },
            select,
          })) as OddsBasedOnOddsType | null;
          if (!oddsFound) {
            throw new Error("Odds not found in matchup finished tx");
          }
          cachedOdds.set(oddsId, oddsFound);
          odds = oddsFound;
        }

        const matchupResult: MatchupResult = {
          awayScore,
          homeScore,
          pointsTotal,
          oddsType,
          drawEligible,
          drawTeam,
          strAwayTeam,
          strHomeTeam,
          pick,
          odds,
        };

        const { result } = getPickResult(matchupResult);

        await tx.pick.update({
          where: { id },
          data: {
            result,
            locked: false,
          },
        });
      }

      const parlays = await tx.parlay.findMany({
        where: { id: { in: [...parlayIdsToUpdate] } },
        include: { Pick: true },
      });

      for (const parlay of parlays) {
        const onePickHasLost = parlay.Pick.some(pick => pick.result === "loss");

        if (onePickHasLost) {
          await tx.parlay.update({
            where: { id: parlay.id },
            data: { pointsAwarded: 0, locked: false },
          });
        }

        const isParlayWin = parlay.Pick.every(pick => ["win", "push"].includes(pick.result));
        const oddsOfWinningPicks: number[] = [];

        if (isParlayWin) {
          const matchupToPickAndOddsId = parlay.Pick.reduce((map, { matchupId, oddsId, pick }) => {
            map.set(matchupId, { oddsId, pick });
            return map;
          }, new Map<string, PickAndOddsId>());

          const matchups = await tx.matchups.findMany({
            where: { id: { in: parlay.Pick.map(({ matchupId }) => matchupId) } },
            select: {
              id: true,
              oddsType: true,
              awayScore: true,
              homeScore: true,
              pointsTotal: true,
              drawEligible: true,
              drawTeam: true,
              strAwayTeam: true,
              strHomeTeam: true,
            },
          });

          if (!matchups.length) {
            logger.error({
              message: "matchup not found when scoring parlay",
              parlayId: parlay.id,
              matchupId: parlay.Pick[0].matchupId,
            });
            continue;
          }

          for (const matchup of matchups) {
            const {
              oddsType,
              awayScore,
              homeScore,
              pointsTotal,
              drawEligible,
              drawTeam,
              strAwayTeam,
              strHomeTeam,
              id,
            } = matchup;

            if (!isOddsType(oddsType)) {
              logger.error({
                message: "invalid odds type found when scoring parlay",
                parlayId: parlay.id,
                matchupId: id,
              });
              continue;
            }

            const select = getSelectFieldsForOddsType(oddsType);
            const { pick, oddsId } = matchupToPickAndOddsId.get(id) ?? {};

            if (!pick || !oddsId) {
              logger.error({
                message: "couldn't parse pick or oddsId from map",
                parlayId: parlay.id,
                matchupId: matchup.id,
              });
              continue;
            }

            const odds = (await tx.odds.findUnique({
              where: { id: oddsId },
              select,
            })) as OddsBasedOnOddsType;

            const matchupResult: MatchupResult = {
              awayScore: Number(awayScore),
              homeScore: Number(homeScore),
              pointsTotal: Number(pointsTotal),
              oddsType,
              drawEligible,
              drawTeam,
              strAwayTeam,
              strHomeTeam,
              pick,
              odds,
            };

            const { result, winningOdds } = getPickResult(matchupResult);
            if (result !== "win" || !winningOdds) {
              logger.warn({
                message:
                  "game not marked as win, excluding from winning odds when calculating pointsAwarded",
                parlayId: parlay.id,
                matchupId: matchup.id,
                result,
              });
              continue;
            }
            oddsOfWinningPicks.push(winningOdds);
          }

          // this should only happen if all parlay picks are pushes
          if (!oddsOfWinningPicks.length) {
            await tx.parlay.update({
              where: { id: parlay.id },
              data: { locked: false },
              // TODO if existing points keep those here. nothing should be won/lost
            });
            continue;
          }

          if (oddsOfWinningPicks.length === 1) {
            const pointsAwarded = getPointsAwarded(oddsOfWinningPicks[0]);
            await tx.parlay.update({
              where: { id: parlay.id },
              data: { pointsAwarded, locked: false },
            });
          } else {
            const BET_SIZE = 100; // this will be dynamic
            const pointsAwarded = calculateParlayPayout(BET_SIZE, oddsOfWinningPicks);
            await tx.parlay.update({
              where: { id: parlay.id },
              data: { pointsAwarded, locked: false },
            });
          }
        }
      }
    });

    logger.info({
      location,
      message: "Success -- completed matchup finished tx to unlock matchup/picks/parlays",
      matchupId: id,
      awayScore,
      homeScore,
      pointsTotal,
    });
  } else {
    const delay = getLiveScoreQueueDelay(strTimestamp);
    await queue.add(
      { id, delay },
      {
        delay,
        attempts: 3,
        removeOnComplete: {
          age: 604800, // keep up to 1 week (in seconds)
          count: 1000, // keep up to 1000 jobs
        },
        backoff: {
          type: "fixed",
          delay: 180000, // 3 minutes
        },
      }
    );
    logger.info({
      message: "Game is IP. Adding back to liveScoreQueue for next update",
      delay,
      location,
      matchupId: id,
    });
  }

  job.finished();
  return id;
});

queue.on("completed", (_, result) => {
  logger.info({ message: "liveScoreQueue job completed", matchupId: result });
});

queue.on("error", (err: Error) => {
  logger.error({ message: "Error in liveScoreQueue", err });
});

queue.on("failed", (job, error) => {
  // TODO create new job here? May continue to fail
  logger.error({
    message: "Job failed in liveScoreQueue",
    jobId: job.id,
    matchupId: job.data?.id,
    error: error.message,
  });
});

setInterval(() => console.log("liveScoreConsumer alive!"), 60000);

process.on("uncaughtException", function (err) {
  logger.error({ err, message: "Uncaught exception" });
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ promise, reason, message: "Unhandled Rejection at: Promise" });
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  await queue.close();
});
