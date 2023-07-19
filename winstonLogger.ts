import dotenv from "dotenv";
import winston from "winston";
import { WinstonTransport as AxiomTransport } from "@axiomhq/axiom-node";

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

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

// if (process.env.NODE_ENV === "production") {
//   console.log("in production block of winstonLogger.ts");

//   logger.add(
//     new AxiomTransport({
//       dataset: process.env.AXIOM_DATASET,
//       token: process.env.AXIOM_TOKEN,
//       orgId: process.env.AXIOM_ORG_ID,
//     })
//   );
// }

logger.log({
  level: "info",
  message: "Logger successfully setup",
});

export default logger;
