import assert from "node:assert/strict";
import test from "node:test";
import { extractRoleNames, extractWannabeId, normalizeWebOrigin } from "./service.js";

test("extracts wannabe id from legacy-compatible claims", () => {
  assert.equal(extractWannabeId({ preferred_username: "crew-12345" }), 12345);
  assert.equal(extractWannabeId({ wannabe_id: 9876 }), 9876);
  assert.equal(extractWannabeId({ email: "user@example.test" }), null);
});

test("extracts unique role titles from Keycloak claims", () => {
  assert.deepEqual(
    extractRoleNames({ roles: ["Logistikk", { title: "Skiftleder" }, "Logistikk"] }),
    ["Logistikk", "Skiftleder"],
  );
});

test("extracts standard Keycloak realm and client roles", () => {
  assert.deepEqual(
    extractRoleNames({
      realm_access: { roles: ["logistikk", "bruker"] },
      resource_access: { bifrost: { roles: ["skiftleder", "logistikk"] } },
    }),
    ["logistikk", "bruker", "skiftleder"],
  );
});

test("normalizes only absolute HTTP origins", () => {
  assert.equal(normalizeWebOrigin("https://bifrost.tg.no/"), "https://bifrost.tg.no");
  assert.equal(normalizeWebOrigin("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
  assert.equal(normalizeWebOrigin("https://bifrost.tg.no/path"), undefined);
  assert.equal(normalizeWebOrigin("javascript:alert(1)"), undefined);
});
