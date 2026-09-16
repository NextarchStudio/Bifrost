import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import type { DatabaseConfig } from "./config.js";
import * as schema from "./schema.js";

export function createDatabase(config: DatabaseConfig) {
  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? {} : undefined,
    charset: "utf8mb4",
    connectionLimit: 10,
    enableKeepAlive: true,
    timezone: "Z",
  });
  return { db: drizzle(pool, { schema, mode: "default" }), pool };
}

export type DatabaseConnection = ReturnType<typeof createDatabase>;
