import { createDatabase, readDatabaseConfig, systemSettings } from "@bifrost/database";
import { eq } from "drizzle-orm";
import { resolve } from "node:path";
import { createSecureSettingsStore } from "../modules/settings/secure-settings.js";

const database = createDatabase(readDatabaseConfig());

try {
  const [legacy] = await database.db
    .select({
      keycloakClientSecret: systemSettings.keycloakClientSecret,
      smtpPass: systemSettings.smtpPass,
      googleMapsApiKey: systemSettings.googleMapsApiKey,
      vegvesenApiKey: systemSettings.vegvesenApiKey,
      crewApiBearerToken: systemSettings.crewApiBearerToken,
    })
    .from(systemSettings)
    .where(eq(systemSettings.id, 1))
    .limit(1);

  if (!legacy) throw new Error("system_settings row 1 finnes ikke");

  const store = await createSecureSettingsStore(
    database,
    resolve(process.cwd(), "../var/secrets/settings.key"),
  );
  const values: Record<string, string | null> = {
    "oidc.client_secret": legacy.keycloakClientSecret,
    "smtp.password": legacy.smtpPass,
    "maps.api_key": legacy.googleMapsApiKey,
    "vegvesen.api_key": legacy.vegvesenApiKey,
    "crew.api_bearer_token": legacy.crewApiBearerToken,
  };

  let migrated = 0;
  for (const [key, value] of Object.entries(values)) {
    if (!value) continue;
    await store.set(key, value);
    console.info("encrypted setting migrated", { key });
    migrated += 1;
  }
  console.info("secret migration completed", { migrated });
} finally {
  await database.pool.end();
}
