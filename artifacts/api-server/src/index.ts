// MUST be first — loads .env from workspace root before any other module runs.
// lib/db checks DATABASE_URL at import time, so dotenv must fire before it.
import "./env";

import app from "./app";
import { logger } from "./lib/logger";
import { startSubscriptionSweep } from "./lib/subscription-sweep";

const rawPort = process.env["PORT"];
const port = rawPort ? Number(rawPort) : 3001;

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Keep stored accountStatus in sync with subscription expiry (see subscription-sweep.ts).
  startSubscriptionSweep();
});
