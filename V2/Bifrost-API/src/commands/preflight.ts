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
    connection.pool.query("SELECT id, enable_local_login AS enableLocalLogin, enable_keycloak_login AS enableKeycloakLogin, keycloak_base_url AS keycloakBaseUrl, keycloak_realm AS keycloakRealm, keycloak_client_id AS keycloakClientId, keycloak_redirect_uri AS keycloakRedirectUri FROM system_settings WHERE id = 1 LIMIT 1"),
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

  const settings = rows<{ id: number; enableLocalLogin: number; enableKeycloakLogin: number; keycloakBaseUrl: string | null; keycloakRealm: string | null; keycloakClientId: string | null; keycloakRedirectUri: string | null }>(settingsResult)[0];
  if (!settings) fail("Systeminnstillinger", "system_settings.id=1 mangler.");
  else {
    pass("Systeminnstillinger", "system_settings.id=1 finnes.");
    const oidcFields = [settings.keycloakBaseUrl, settings.keycloakRealm, settings.keycloakClientId, settings.keycloakRedirectUri];
    if (!settings.enableKeycloakLogin || settings.enableLocalLogin || oidcFields.some((value) => !value?.trim())) fail("OIDC", "Keycloak må være aktiv, lokal innlogging av og alle offentlige OIDC-felt utfylt.");
    else pass("OIDC", "Keycloak er aktiv og lokal innlogging er av.");
  }

  const protectedUser = rows<{ id: number; name: string; email: string }>(userResult)[0];
  if (!protectedUser) fail("Beskyttet bruker", "Bruker-ID 2 mangler; crew-reset er ikke sikker å kjøre.");
  else pass("Beskyttet bruker", `#2 ${protectedUser.name} (${protectedUser.email}) finnes.`);

  const roleNames = rows<{ name: string }>(rolesResult).map((row) => row.name);
  const absentRoles = missingRoles(roleNames, BIFROST_ROLES);
  if (absentRoles.length) fail("V1-roller", `Mangler: ${absentRoles.join(", ")}`); else pass("V1-roller", `${BIFROST_ROLES.length} autoritative roller finnes.`);

  const secureKeys = rows<{ key: string }>(secureKeysResult).map((row) => row.key);
  if (!secureKeys.length) warn("Krypterte innstillinger", "Ingen krypterte verdier er migrert til bifrost_secure_settings.");
  else pass("Krypterte innstillinger", `${secureKeys.length} krypterte innstillingsnøkler finnes.`);

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
