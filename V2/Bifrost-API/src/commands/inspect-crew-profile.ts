import { createDatabase, readDatabaseConfig, systemSettings } from "@bifrost/database";
import { eq } from "drizzle-orm";
import { resolve } from "node:path";
import { createSecureSettingsStore } from "../modules/settings/secure-settings.js";

const crewId = process.argv[2]?.trim();
if (!crewId || !/^\d+$/.test(crewId) || Number(crewId) < 1) {
  console.error("Bruk: pnpm --filter @bifrost/api inspect:crew -- <wannabe-id>");
  process.exitCode = 1;
} else {
  const database = createDatabase(readDatabaseConfig());
  try {
    const [settings] = await database.db.select({
      baseUrl: systemSettings.crewApiBaseUrl,
      profileEndpoint: systemSettings.crewApiProfileEndpoint,
    }).from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
    const secrets = await createSecureSettingsStore(database, resolve(process.cwd(), "../var/secrets/settings.key"));
    const token = await secrets.get("crew.api_bearer_token");
    if (!settings?.baseUrl || !settings.profileEndpoint || !token) {
      throw new Error("Crew API URL, profilendepunkt eller kryptert bearer-token mangler.");
    }

    const base = settings.baseUrl.endsWith("/") ? settings.baseUrl : `${settings.baseUrl}/`;
    const url = new URL(settings.profileEndpoint.replace(/^\//, ""), base);
    if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("Crew API URL bruker ugyldig protokoll.");
    url.searchParams.set("uid", crewId);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* Behold tekstrespons for diagnostikk. */ }
    console.info(JSON.stringify({
      status: response.status,
      contentType: response.headers.get("content-type"),
      requestUrl: url.toString(),
      body,
    }, null, 2));
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Crew API-oppslaget feilet.");
    process.exitCode = 1;
  } finally {
    await database.pool.end();
  }
}
