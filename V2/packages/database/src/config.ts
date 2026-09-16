import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().min(1).max(65_535).default(3306),
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_SSL: z.enum(["true", "false"]).default("false"),
});

export type DatabaseConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

export function readDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const value = databaseEnvSchema.parse(env);
  return {
    host: value.DATABASE_HOST,
    port: value.DATABASE_PORT,
    database: value.DATABASE_NAME,
    user: value.DATABASE_USER,
    password: value.DATABASE_PASSWORD,
    ssl: value.DATABASE_SSL === "true",
  };
}
