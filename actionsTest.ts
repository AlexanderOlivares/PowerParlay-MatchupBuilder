import logger from "./winstonLogger.ts";

console.log("Did i run?");
console.log(process.env.NODE_ENV);

logger.error("Hello World");
logger.warn("Hello World");
logger.info("Hello World");
logger.http("Hello World");
