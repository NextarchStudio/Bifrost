import assert from "node:assert/strict";
import test from "node:test";
import { createSearchPattern } from "./service.js";

test("sanitizes and escapes V1 global search input", () => {
  assert.equal(createSearchPattern("  <b>radio</b>%_!  "), "%radio!%!_!!%");
  assert.equal(createSearchPattern("   "), null);
  assert.equal(Array.from(createSearchPattern("æ".repeat(120)) ?? "").length, 102);
});
