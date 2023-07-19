import dotenv from "dotenv";
import winston from "winston";
import { WinstonTransport as AxiomTransport } from "@axiomhq/axiom-node";
import axios from "axios";
import util from "util";

dotenv.config();

const logger = winston.createLogger({
  level: "http",
  format: winston.format.json(),
});

// if (process.env.NODE_ENV !== "production") {
//   logger.add(
//     new winston.transports.Console({
//       format: winston.format.simple(),
//     })
//   );
// }

if (process.env.NODE_ENV === "production") {
  const url = "https://jsonplaceholder.typicode.com/todos/1";

  async function makeRequest() {
    try {
      const response = await axios.get(url);
      const data = response.data;

      console.log(data);
    } catch (error) {
      console.error(error);
    }
  }

  makeRequest();

  logger.add(
    new AxiomTransport({
      dataset: process.env.AXIOM_DATASET,
      token: process.env.AXIOM_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
      level: "debug",
    })
  );
}

logger.transports.forEach(t => {
  console.log(util.inspect(t, { depth: null }));
});

logger.log({
  level: "info",
  message: "util inspect",
});

export default logger;
