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

if (process.env.NODE_ENV === "production") {
  logger.add(new AxiomTransport({}));
}

// logger.error({
//   level: "error",
//   message: "hello!",
// });
logger.warn({
  level: "warn",
  message: "new transport config",
});
logger.info({
  level: "info",
  message: "new transport config",
});
logger.http({
  level: "http",
  message: "new transport config",
});

throw new Error("alex threw this uncaught error");

export default logger;
