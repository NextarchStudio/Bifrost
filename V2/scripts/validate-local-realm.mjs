import { readFile } from "node:fs/promises";

const requiredRoles = [
  "developer",
  "chief",
  "co-chief",
  "transport_ansvarlig",
  "skiftleder",
  "sambandsansvarlig",
  "logistikk",
  "shop",
  "innkjop",
  "bruker",
  "ingen_tilbakemeldinger",
];

const realmUrl = new URL("../keycloak/bifrost-local-realm.json", import.meta.url);
const realm = JSON.parse(await readFile(realmUrl, "utf8"));
const actualRoles = realm.roles?.realm?.map((role) => role.name) ?? [];
const webClient = realm.clients?.find((client) => client.clientId === "bifrost-web");

assert(realm.realm === "bifrost-local", "Forventet realm bifrost-local.");
assert(JSON.stringify(actualRoles) === JSON.stringify(requiredRoles), "Keycloak-rollene avviker fra de 11 V1-rollene.");
assert(!Object.hasOwn(realm, "users"), "Lokal realmfil skal ikke inneholde brukere eller passord.");
assert(webClient?.enabled === true, "bifrost-web-klienten må være aktiv.");
assert(webClient?.publicClient === true, "bifrost-web må være en offentlig klient.");
assert(webClient?.standardFlowEnabled === true, "Authorization Code-flyten må være aktiv.");
assert(webClient?.directAccessGrantsEnabled === false, "Direct Access Grants skal være deaktivert.");
assert(webClient?.attributes?.["pkce.code.challenge.method"] === "S256", "PKCE S256 må være påkrevd.");

console.info("Local infrastructure config valid: bifrost-local, 11 roles, public PKCE client, no users.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
