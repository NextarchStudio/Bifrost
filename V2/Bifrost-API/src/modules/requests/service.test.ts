import assert from "node:assert/strict";
import test from "node:test";
import { requestStatusFromItemStatuses } from "./service.js";

test("derives approved and rejected request states from all lines", () => {
  assert.equal(requestStatusFromItemStatuses(["approved", "approved"]), "approved");
  assert.equal(requestStatusFromItemStatuses(["rejected", "rejected"]), "rejected");
});

test("derives partial state when approved and unresolved lines are mixed", () => {
  assert.equal(requestStatusFromItemStatuses(["approved", "pending"]), "partial");
  assert.equal(requestStatusFromItemStatuses(["partial", "rejected"]), "partial");
  assert.equal(requestStatusFromItemStatuses(["pending", "rejected"]), "pending");
});
