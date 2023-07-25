import dotenv from "dotenv";
import winston from "winston";
import { WinstonTransport as AxiomTransport } from "@axiomhq/axiom-node";

dotenv.config();

const transports = [];

if (process.env.NODE_ENV === "production") {
  const axiomTransport = new AxiomTransport({});
  transports.push(axiomTransport);
} else {
  transports.push(
    new winston.transports.Console({
      format: winston.format.json(),
    })
  );
}

const logger = winston.createLogger({
  level: "http",
  format: winston.format.json(),
  transports: transports,
  exceptionHandlers: transports,
  rejectionHandlers: transports,
});

export default logger;
