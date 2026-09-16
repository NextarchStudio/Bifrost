import { createDatabase, readDatabaseConfig } from "@bifrost/database";

const intervalMs = 30_000;
const database = createDatabase(readDatabaseConfig());
let running = false;

const run = async (): Promise<void> => {
  if (running) return;
  running = true;
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
  } finally {
    running = false;
  }
};

const timer = setInterval(() => void run(), intervalMs);
const shutdown = async (signal: string): Promise<void> => {
  console.info("bifrost-worker shutting down", { signal });
  clearInterval(timer);
  await database.pool.end();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

console.info("bifrost-worker started", { intervalMs });
await run();
