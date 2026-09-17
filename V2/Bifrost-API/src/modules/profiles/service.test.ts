import assert from "node:assert/strict";
import test from "node:test";
import type { CurrentUser } from "@bifrost/contracts";
import { profileAccess } from "./service.js";

const user = (roles: string[], wannabeId = 100): CurrentUser => ({
  id: 1,
  name: "Test Bruker",
  firstName: "Test",
  lastName: "Bruker",
  email: "test@example.test",
  wannabeId,
  roles,
});

test("always allows a user to view their own requests and loans", () => {
  assert.deepEqual(profileAccess(user(["bruker"]), 100), {
    isOwnProfile: true,
    canViewOtherProfiles: false,
    canViewRequests: true,
  });
});

test("allows logistics to view another user's loans but not requests", () => {
  assert.deepEqual(profileAccess(user(["logistikk"]), 200), {
    isOwnProfile: false,
    canViewOtherProfiles: true,
    canViewRequests: false,
  });
});

test("allows skiftleder to view another user's loans and requests", () => {
  assert.deepEqual(profileAccess(user(["skiftleder"]), 200), {
    isOwnProfile: false,
    canViewOtherProfiles: true,
    canViewRequests: true,
  });
});
