import moment from "moment";

export function getOddsQueueDelay(strTimestamp: string): number {
  const now = moment();
  const future = moment(strTimestamp);

  const hours = future.diff(now, "hours");
  const minutes = future.diff(now, "minutes");

  if (hours > 8) return 14400; // 4 hours
  if (hours > 4) return 7200; // 2 hours
  if (hours > 1) return 3600; // 1 hour
  if (minutes > 30) return 1200; // 20 minutes
  return 0; // back-off under 30 minutes
}
