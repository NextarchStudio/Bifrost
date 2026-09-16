import assert from "node:assert/strict";
import test from "node:test";
import { extractRoleNames, extractWannabeId } from "./service.js";

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
