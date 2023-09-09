import moment from "moment";

export function getMsToGameTime(strTimestamp: string): number {
  const now = moment();
  // Add 5 seconds of buffer time. This func just needs to be approx
  const gameTime = moment(strTimestamp).add(5, "seconds");
  return gameTime.diff(now);
}

export function getLiveScoreQueueDelay(strTimestamp: string): number {
  const now = moment();
  const gameStartTime = moment(strTimestamp);
  const hours = now.diff(gameStartTime, "hours");

  // Delay time in milliseconds
  if (hours > 2) return 180000; // 3 minutes
  if (hours > 1) return 600000; // 10 minutes
  return 1800000; // 30 minutes
}

export function gameTimeInPast(strTimestamp: string) {
  const gameTime = moment.utc(strTimestamp);
  return gameTime.isBefore(moment.utc());
}

export function convertStringNumberToRealNumber(str: string) {
  const num = Number(str);
  if (num === 0) {
    return num;
  } else if (!num) {
    throw new Error(`Invalid input: "${str}" is not a valid number.`);
  } else {
    return num;
  }
}

export function getScoresAsNums(awayRawScore: string, homeRawScore: string) {
  const awayScore = convertStringNumberToRealNumber(awayRawScore);
  const homeScore = convertStringNumberToRealNumber(homeRawScore);
  return { awayScore, homeScore };
}

export function getWinner(awayRawScore: string, homeRawScore: string) {
  const awayScore = Number(awayRawScore);
  const homeScore = Number(homeRawScore);
  if (!awayScore || !homeScore) {
    throw new Error("Score(s) are falsy in getWinner");
  }
  if (awayScore === homeScore) return "draw";
  return awayScore > homeScore ? "away" : "home";
}
