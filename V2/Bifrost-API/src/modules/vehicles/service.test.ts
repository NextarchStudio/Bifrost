import assert from "node:assert/strict";
import test from "node:test";
import type { VehicleCompetencyProfile } from "@bifrost/contracts";
import { competencyRequirementSatisfied } from "./service.js";

const profile = (selected: string[] = [], kdoForVehicle = false): VehicleCompetencyProfile => ({
  wannabeId: 12345,
  competencies: {
    t1: selected.includes("t1"),
    t2: selected.includes("t2"),
    t3: selected.includes("t3"),
    t4: selected.includes("t4"),
    b: selected.includes("b"),
    be: selected.includes("be"),
    c1: selected.includes("c1"),
    c1e: selected.includes("c1e"),
    c: selected.includes("c"),
    ce: selected.includes("ce"),
  },
  kdoForVehicle,
});

test("accepts an explicitly stored vehicle KDO", () => {
  assert.equal(competencyRequirementSatisfied("kdo", null, profile([], true)), true);
});

test("accepts configured competency as a KDO override", () => {
  assert.equal(competencyRequirementSatisfied("kdo", "t1", profile(["t1"])), true);
});

test("rejects a missing driving licence requirement", () => {
  assert.equal(competencyRequirementSatisfied("b", null, profile(["t1"])), false);
});

test("accepts vehicles without competency requirements", () => {
  assert.equal(competencyRequirementSatisfied("none", null, profile()), true);
});
