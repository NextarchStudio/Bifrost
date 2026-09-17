import { webOrigins, type DatabaseConnection } from "@bifrost/database";
import { asc, eq } from "drizzle-orm";

export const BOOTSTRAP_WEB_ORIGINS = [
  "https://tg.legacyh.dev",
  "https://bifrost.tg.no",
  "http://127.0.0.1:3000",
] as const;

export async function loadActiveWebOrigins(database: DatabaseConnection): Promise<{ origins: string[]; usingBootstrapFallback: boolean }> {
  try {
    const rows = await database.db.select({ origin: webOrigins.origin }).from(webOrigins)
      .where(eq(webOrigins.enabled, true)).orderBy(asc(webOrigins.id));
    return { origins: rows.map(({ origin }) => origin), usingBootstrapFallback: false };
  } catch (error) {
    if (!isMissingWebOriginsTable(error)) throw error;
    return { origins: [...BOOTSTRAP_WEB_ORIGINS], usingBootstrapFallback: true };
  }
}

export async function isActiveWebOrigin(database: DatabaseConnection, origin: string): Promise<boolean> {
  try {
    const rows = await database.db.select({ origin: webOrigins.origin }).from(webOrigins)
      .where(eq(webOrigins.origin, origin)).limit(1);
    return rows.length > 0;
  } catch (error) {
    if (!isMissingWebOriginsTable(error)) throw error;
    return BOOTSTRAP_WEB_ORIGINS.includes(origin as (typeof BOOTSTRAP_WEB_ORIGINS)[number]);
  }
}

function isMissingWebOriginsTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; errno?: unknown; cause?: unknown };
  if (candidate.code === "ER_NO_SUCH_TABLE" || candidate.errno === 1146) return true;
  return candidate.cause !== error && isMissingWebOriginsTable(candidate.cause);
}
