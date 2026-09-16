import { buildApp } from "./app.js";
import { createDatabase, readDatabaseConfig } from "@bifrost/database";

const database = createDatabase(readDatabaseConfig());
const app = buildApp({
  checkDatabase: async () => {
    const connection = await database.pool.getConnection();
    try {
      await connection.ping();
    } finally {
      connection.release();
    }
  },
});

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await database.pool.end();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: "0.0.0.0", port: 3001 });
