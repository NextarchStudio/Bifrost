import { createDatabase, readDatabaseConfig } from "@bifrost/database";

const intervalMs = 30_000;
const database = createDatabase(readDatabaseConfig());
let activeRun: Promise<void> | undefined;
let shuttingDown = false;

const heartbeat = async (): Promise<void> => {
  try {
    const connection = await database.pool.getConnection();
    try {
      await connection.ping();
      console.info("worker heartbeat", { database: "connected", timestamp: new Date().toISOString() });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("worker heartbeat failed", error);
  }
};

const run = (): Promise<void> => {
  if (activeRun) return activeRun;
  activeRun = heartbeat().finally(() => {
    activeRun = undefined;
  });
  return activeRun;
};

const timer = setInterval(() => void run(), intervalMs);
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info("Bifrost-Worker shutting down", { signal });
  clearInterval(timer);

  try {
    await activeRun;
    await database.pool.end();
    console.info("Bifrost-Worker shutdown complete", { signal });
  } catch (error) {
    console.error("Bifrost-Worker shutdown failed", { error, signal });
    process.exitCode = 1;
  }
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

console.info("Bifrost-Worker started", { intervalMs });
await run();
