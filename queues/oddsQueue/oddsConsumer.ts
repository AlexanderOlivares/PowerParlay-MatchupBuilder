import Queue from "bull";
import dotenv from "dotenv";
import { Job } from "../../interfaces/queue";

dotenv.config({ path: "../../.env" });

const queue = new Queue("oddsQueue", process.env.REDIS_HOST!);

queue.process(async (job: any) => {
  console.log(job.data);
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
