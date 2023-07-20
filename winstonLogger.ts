import dotenv from "dotenv";
import winston from "winston";
import { WinstonTransport as AxiomTransport } from "@axiomhq/axiom-node";
import util from "util";

dotenv.config();

const logger = winston.createLogger({
  level: "http",
  format: winston.format.json(),
  transports: [
    new AxiomTransport({
      dataset: process.env.AXIOM_DATASET,
      token: process.env.AXIOM_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
    }),
  ],
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
  message: "hello from gh actions!",
});
// logger.warn({
//   level: "warn",
//   message: "from gh actions!",
// });
// logger.info({
//   level: "info",
// });
// logger.http({
//   level: "http",
//   message: "from gh actions!",
// });

export default logger;
