import assert from "node:assert/strict";
import test from "node:test";
import { AdminDomainError, crewProvisioningRuleMatches, validateWelcomeEmailConfiguration } from "./service.js";

const profile = { crewName: "Arena:Logistikk", role: "Skiftleder", roleName: "shift-lead" };

test("matches both a crew-wide base rule and a specific crew role", () => {
  assert.equal(crewProvisioningRuleMatches(profile, { crewName: "arena:logistikk", crewRole: null }), true);
  assert.equal(crewProvisioningRuleMatches(profile, { crewName: " Arena:Logistikk ", crewRole: "skiftleder" }), true);
  assert.equal(crewProvisioningRuleMatches(profile, { crewName: "Arena:Logistikk", crewRole: "shift-lead" }), true);
});

test("does not grant roles from another crew or another crew role", () => {
  assert.equal(crewProvisioningRuleMatches(profile, { crewName: "Arena:Innkjøp", crewRole: null }), false);
  assert.equal(crewProvisioningRuleMatches(profile, { crewName: "Arena:Logistikk", crewRole: "Chief" }), false);
});

test("allows disabled welcome email without SMTP configuration", () => {
  assert.doesNotThrow(() => validateWelcomeEmailConfiguration({ enabled: false }, false));
});

test("requires complete SMTP configuration before welcome email is enabled", () => {
  assert.throws(
    () => validateWelcomeEmailConfiguration({ enabled: true, fromEmail: "bifrost@example.test", host: null, port: 587 }, true),
    (error) => error instanceof AdminDomainError && error.code === "CONFLICT",
  );
  assert.throws(
    () => validateWelcomeEmailConfiguration({ enabled: true, fromEmail: "bifrost@example.test", host: "smtp.example.test", port: 587, username: "bifrost" }, false),
    (error) => error instanceof AdminDomainError && error.code === "CONFLICT",
  );
  assert.doesNotThrow(() => validateWelcomeEmailConfiguration({ enabled: true, fromEmail: "bifrost@example.test", host: "smtp.example.test", port: 587, username: "bifrost" }, true));
});
