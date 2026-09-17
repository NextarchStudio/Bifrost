import assert from "node:assert/strict";
import test from "node:test";
import type { VehicleCompetencyCode } from "@bifrost/contracts";
import { geocodeQueries } from "./routing.js";
import { userCanHandleVehicle } from "./service.js";

const competencies = (...selected: VehicleCompetencyCode[]): Record<VehicleCompetencyCode, boolean> => ({
  t1: selected.includes("t1"), t2: selected.includes("t2"), t3: selected.includes("t3"), t4: selected.includes("t4"),
  b: selected.includes("b"), be: selected.includes("be"), c1: selected.includes("c1"), c1e: selected.includes("c1e"),
  c: selected.includes("c"), ce: selected.includes("ce"),
});

test("keeps the Norwegian geocoding fallbacks from V1 without duplicates", () => {
  const queries = geocodeQueries("Testveien 1");
  assert.deepEqual(queries, ["Testveien 1", "Testveien 1, Norway", "Testvegen 1", "Testvegen 1, Norway"]);
});

test("accepts a driver with the required licence", () => {
  assert.equal(userCanHandleVehicle(
    { wannabeId: 123 },
    { competencyRequirement: "b", competencyOverrideRequirement: null },
    competencies("b"),
  ), true);
});

test("accepts vehicle-specific KDO or the configured override", () => {
  const vehicle = { competencyRequirement: "kdo", competencyOverrideRequirement: "t1" };
  assert.equal(userCanHandleVehicle({ wannabeId: 123 }, vehicle, competencies(), true), true);
  assert.equal(userCanHandleVehicle({ wannabeId: 123 }, vehicle, competencies("t1"), false), true);
  assert.equal(userCanHandleVehicle({ wannabeId: 123 }, vehicle, competencies(), false), false);
});

test("allows users without Wannabe-ID only when the vehicle has no requirement", () => {
  assert.equal(userCanHandleVehicle({ wannabeId: null }, { competencyRequirement: "none", competencyOverrideRequirement: null }), true);
  assert.equal(userCanHandleVehicle({ wannabeId: null }, { competencyRequirement: "b", competencyOverrideRequirement: null }), false);
});
