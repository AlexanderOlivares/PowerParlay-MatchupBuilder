import dotenv from "dotenv";
import winston from "winston";
import { WinstonTransport as AxiomTransport } from "@axiomhq/axiom-node";

dotenv.config();

const axiomTransport = new AxiomTransport({});

const logger = winston.createLogger({
  level: "http",
  format: winston.format.json(),
  transports: [axiomTransport],
  exceptionHandlers: [axiomTransport],
  rejectionHandlers: [axiomTransport],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

// if (process.env.NODE_ENV === "production") {
//   logger.add(new AxiomTransport({}));
// }

logger.error({
  message: "error",
});
logger.warn({
  message: "new transport config",
});
logger.info({
  message: "new transport config",
});
logger.http({
  level: "http",
  message: "new transport config",
});

function rejectWithError() {
  return new Promise((resolve, reject) => {
    reject(new Error("Rejected promise"));
  });
}

rejectWithError();

export default logger;
