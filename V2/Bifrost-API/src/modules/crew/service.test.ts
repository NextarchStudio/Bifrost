import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCrewProfile } from "./service.js";

test("normalizes Crew API identity fields used by admin badge lookup", () => {
  assert.deepEqual(normalizeCrewProfile({
    id: "8468",
    name: "Ola Nordmann",
    given_name: "Ola",
    family_name: "Nordmann",
    email: "OLA@example.test ",
    nickname: "olan",
    crew_name: "Arena:Logistikk",
  }), {
    id: 8468,
    name: "Ola Nordmann",
    firstName: "Ola",
    lastName: "Nordmann",
    email: "ola@example.test",
    nickname: "olan",
    crewName: "Arena:Logistikk",
    roleTitle: "",
    roleName: "",
  });
});

test("splits a full name and rejects an invalid email when separate fields are absent", () => {
  const profile = normalizeCrewProfile({ id: 12, name: "Kari Nord Mann", mail: "not-an-email" });
  assert.equal(profile?.firstName, "Kari Nord");
  assert.equal(profile?.lastName, "Mann");
  assert.equal(profile?.email, "");
});
