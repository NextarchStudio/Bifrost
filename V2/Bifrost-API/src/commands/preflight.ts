import { BIFROST_ROLES } from "@bifrost/contracts";
import * as databaseExports from "@bifrost/database";
import { createDatabase, readDatabaseConfig } from "@bifrost/database";
import { getTableColumns, getTableName, isTable } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compareSchema, missingRoles, type SchemaColumn } from "./preflight-checks.js";

let database: ReturnType<typeof createDatabase> | undefined;
let failures = 0;
let warnings = 0;

try {
  const connection = createDatabase(readDatabaseConfig());
  database = connection;
  const [versionResult, columnsResult, settingsResult, userResult, rolesResult, secureKeysResult] = await Promise.all([
    connection.pool.query("SELECT VERSION() AS version, DATABASE() AS databaseName"),
    connection.pool.query("SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()"),
    connection.pool.query("SELECT id, enable_local_login AS enableLocalLogin, enable_keycloak_login AS enableKeycloakLogin, keycloak_base_url AS keycloakBaseUrl, keycloak_realm AS keycloakRealm, keycloak_client_id AS keycloakClientId, keycloak_redirect_uri AS keycloakRedirectUri, crew_provisioning_email_enabled AS crewProvisioningEmailEnabled, smtp_from_email AS smtpFromEmail, smtp_host AS smtpHost, smtp_port AS smtpPort, smtp_user AS smtpUser, NULLIF(TRIM(keycloak_client_secret), '') IS NOT NULL AS hasLegacyOidcSecret, NULLIF(TRIM(smtp_pass), '') IS NOT NULL AS hasLegacySmtpPassword, NULLIF(TRIM(vegvesen_api_key), '') IS NOT NULL AS hasLegacyVegvesenKey, NULLIF(TRIM(crew_api_bearer_token), '') IS NOT NULL AS hasLegacyCrewToken FROM system_settings WHERE id = 1 LIMIT 1"),
    connection.pool.query("SELECT id, name, email FROM users WHERE id = 2 LIMIT 1"),
    connection.pool.query("SELECT name FROM roles ORDER BY name"),
    connection.pool.query("SELECT `key` FROM bifrost_secure_settings ORDER BY `key`"),
  ]);

  const version = rows<{ version: string; databaseName: string }>(versionResult)[0];
  if (!version) fail("Database", "Kunne ikke lese databaseversjon.");
  else {
    pass("Database", `${version.databaseName} · ${version.version}`);
    const parsed = /^(\d+)\.(\d+)/.exec(version.version);
    if (!/mariadb/i.test(version.version) || !parsed || Number(parsed[1]) < 10 || (Number(parsed[1]) === 10 && Number(parsed[2]) < 6)) fail("MariaDB-versjon", "MariaDB 10.6 eller nyere kreves.");
    else pass("MariaDB-versjon", "Kravet 10.6+ er oppfylt.");
  }

  const expectedSchema: Record<string, string[]> = {};
  for (const candidate of Object.values(databaseExports) as unknown[]) {
    if (!isTable(candidate)) continue;
    expectedSchema[getTableName(candidate)] = Object.values(getTableColumns(candidate)).map((column) => column.name);
  }
  const schema = compareSchema(expectedSchema, rows<SchemaColumn>(columnsResult));
  if (schema.missingTables.length) fail("Tabeller", `Mangler: ${schema.missingTables.join(", ")}`); else pass("Tabeller", `${Object.keys(expectedSchema).length} forventede tabeller finnes.`);
  if (schema.missingColumns.length) fail("Kolonner", `Mangler: ${schema.missingColumns.join(", ")}`); else pass("Kolonner", "Alle forventede kolonner finnes.");

  const settings = rows<{ id: number; enableLocalLogin: number; enableKeycloakLogin: number; keycloakBaseUrl: string | null; keycloakRealm: string | null; keycloakClientId: string | null; keycloakRedirectUri: string | null; crewProvisioningEmailEnabled: number; smtpFromEmail: string | null; smtpHost: string | null; smtpPort: number | null; smtpUser: string | null; hasLegacyOidcSecret: number; hasLegacySmtpPassword: number; hasLegacyVegvesenKey: number; hasLegacyCrewToken: number }>(settingsResult)[0];
  if (!settings) fail("Systeminnstillinger", "system_settings.id=1 mangler.");
  else {
    pass("Systeminnstillinger", "system_settings.id=1 finnes.");
    const oidcFields = [settings.keycloakBaseUrl, settings.keycloakRealm, settings.keycloakClientId, settings.keycloakRedirectUri];
    if (!settings.enableKeycloakLogin || oidcFields.some((value) => !value?.trim())) fail("OIDC", "Keycloak må være aktiv og alle offentlige OIDC-felt utfylt.");
    else pass("OIDC", `Keycloak er aktiv; lokal reserveinnlogging er ${settings.enableLocalLogin ? "på" : "av"}.`);
    if (settings.crewProvisioningEmailEnabled && (!settings.smtpFromEmail || !settings.smtpHost || !settings.smtpPort)) fail("Crew-e-post", "E-postutsendelse er aktiv, men SMTP-avsender, vert eller port mangler.");
    else pass("Crew-e-post", `Automatisk velkomst-e-post er ${settings.crewProvisioningEmailEnabled ? "på" : "av"}.`);
  }

  const protectedUser = rows<{ id: number; name: string; email: string }>(userResult)[0];
  if (!protectedUser) fail("Beskyttet bruker", "Bruker-ID 2 mangler; crew-reset er ikke sikker å kjøre.");
  else pass("Beskyttet bruker", `#2 ${protectedUser.name} (${protectedUser.email}) finnes.`);

  const roleNames = rows<{ name: string }>(rolesResult).map((row) => row.name);
  const absentRoles = missingRoles(roleNames, BIFROST_ROLES);
  if (absentRoles.length) fail("V1-roller", `Mangler: ${absentRoles.join(", ")}`); else pass("V1-roller", `${BIFROST_ROLES.length} autoritative roller finnes.`);

  const secureKeys = rows<{ key: string }>(secureKeysResult).map((row) => row.key);
  const requiredSecureKeys = settings ? [
    settings.enableKeycloakLogin ? "oidc.client_secret" : null,
    (settings.crewProvisioningEmailEnabled && settings.smtpUser) || settings.hasLegacySmtpPassword ? "smtp.password" : null,
    settings.hasLegacyVegvesenKey ? "vegvesen.api_key" : null,
    settings.hasLegacyCrewToken ? "crew.api_bearer_token" : null,
  ].filter((key): key is string => Boolean(key)) : [];
  const missingSecureKeys = requiredSecureKeys.filter((key) => !secureKeys.includes(key));
  if (missingSecureKeys.length) fail("Krypterte innstillinger", `Konfigurerte V1-hemmeligheter mangler kryptert kopi: ${missingSecureKeys.join(", ")}`);
  else if (!secureKeys.length) warn("Krypterte innstillinger", "Ingen krypterte verdier finnes; bekreft at ingen integrasjonshemmeligheter er nødvendige.");
  else pass("Krypterte innstillinger", `${secureKeys.length} krypterte innstillingsnøkler finnes.`);

  if (schema.missingTables.includes("bifrost_web_origins")) {
    fail("Web-domener", "Migrering 0003_web_origins.sql er ikke kjørt.");
  } else {
    const webOriginsResult = await connection.pool.query("SELECT origin FROM bifrost_web_origins WHERE enabled = 1 ORDER BY id");
    const configuredOrigins = new Set(rows<{ origin: string }>(webOriginsResult).map((row) => row.origin));
    const requiredOrigins = ["https://tg.legacyh.dev", "https://bifrost.tg.no", "http://127.0.0.1:3000"];
    const missingOrigins = requiredOrigins.filter((origin) => !configuredOrigins.has(origin));
    if (missingOrigins.length) fail("Web-domener", `Mangler aktive origins: ${missingOrigins.join(", ")}`);
    else pass("Web-domener", "Begge HTTPS-domener og lokal utviklingsadresse er aktive.");
  }
  if (schema.missingTables.includes("bifrost_crew_provisioning_rules") || schema.missingColumns.includes("system_settings.crew_provisioning_email_enabled")) {
    fail("Crew-provisjonering", "Migrering 0004_crew_provisioning.sql er ikke kjørt.");
  }

  try {
    const encodedKey = (await readFile(resolve(process.cwd(), "../var/secrets/settings.key"), "utf8")).trim();
    if (Buffer.from(encodedKey, "base64url").length !== 32) fail("Krypteringsnøkkel", "settings.key inneholder ikke en gyldig 32-byte nøkkel.");
    else pass("Krypteringsnøkkel", "Lokal 32-byte master key finnes.");
  } catch { fail("Krypteringsnøkkel", "../var/secrets/settings.key mangler eller kan ikke leses."); }
} catch (error) {
  fail("Preflight", error instanceof Error ? error.message : "Ukjent feil.");
} finally {
  await database?.pool.end();
}

console.info(`Preflight ferdig: ${failures} feil, ${warnings} advarsler.`);
if (failures) process.exitCode = 1;

function rows<T>(result: unknown): T[] { return (result as [unknown])[0] as T[]; }
function pass(name: string, detail: string) { console.info(`PASS  ${name}: ${detail}`); }
function warn(name: string, detail: string) { warnings += 1; console.warn(`WARN  ${name}: ${detail}`); }
function fail(name: string, detail: string) { failures += 1; console.error(`FAIL  ${name}: ${detail}`); }
