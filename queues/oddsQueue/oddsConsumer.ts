import Queue from "bull";
import dotenv from "dotenv";
import { Job } from "../../interfaces/queue";
import { Matchup, Odds } from "../../interfaces/matchup";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import logger from "../../winstonLogger.ts";
import { getOddsQueueDelay } from "../../utils/oddsQueueUtils.ts";

dotenv.config({ path: "../../.env" });

const queue = new Queue("oddsQueue", process.env.REDIS_HOST!);
const prisma = new PrismaClient();

queue.process(async (job: any) => {
  logger.info({ message: "odds queue test", data: job.data });

  const { id } = job.data;

  const odds = await prisma.matchups.findUnique({
    where: {
      id,
      used: true,
    },
    include: {
      Odds: true,
    },
  });

  if (odds?.strTimestamp) {
    const delay = getOddsQueueDelay(odds.strTimestamp);
    if (delay) {
      await queue.add({ id, msDelay: delay }, { delay });
    }
  }
  job.finish();
});

queue.on("completed", (job: Job) => {
  console.log(`Completed job ${job.id}`);
});

queue.on("error", (err: Error) => {
  console.log("Queue error", err);
});

setInterval(() => console.log("Consumer alive!"), 10000);

process.on("SIGTERM", () => {
  queue.close();
});
