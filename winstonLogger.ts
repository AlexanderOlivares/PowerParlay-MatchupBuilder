import dotenv from "dotenv";
import winston from "winston";
import { WinstonTransport as AxiomTransport } from "@axiomhq/axiom-node";
import util from "util";

dotenv.config();

const logger = winston.createLogger({
  level: "http",
  format: winston.format.json(),
  transports: [new AxiomTransport({})],
});

// if (process.env.NODE_ENV !== "production") {
//   logger.add(
//     new winston.transports.Console({
//       format: winston.format.simple(),
//     })
//   );
// }

// if (process.env.NODE_ENV !== "production") {
//   logger.add(new AxiomTransport({}));
// }

logger.transports.forEach(t => {
  console.log(util.inspect(t, { depth: null }));
});

logger.error({
  level: "error",
  message: "from gh actions!",
});
logger.warn({
  level: "warn",
  message: "from gh actions!",
});
logger.info({
  level: "info",
});
logger.http({
  level: "http",
  message: "from gh actions!",
});

export default logger;
