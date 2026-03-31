import app from "./app";
import { logger } from "./lib/logger";
import { deleteExpiredEvents } from "./lib/cleanup";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Run once immediately on startup, then every 24 hours
  deleteExpiredEvents().catch((e) =>
    logger.error({ err: e instanceof Error ? e.message : String(e) }, "[cleanup] startup sweep failed")
  );

  const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  setInterval(() => {
    deleteExpiredEvents().catch((e) =>
      logger.error({ err: e instanceof Error ? e.message : String(e) }, "[cleanup] scheduled sweep failed")
    );
  }, INTERVAL_MS);

  logger.info({ intervalHours: 24 }, "[cleanup] Scheduler started");
});
