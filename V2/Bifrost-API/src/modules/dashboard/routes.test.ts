import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../app.js";
import type { DashboardService } from "./service.js";

const service = (overrides: Partial<DashboardService> = {}): DashboardService => ({
  summary: async () => ({ activeLoans: 3, activeVehicleLoans: 1, activeTransportJobs: 2, totalTransportDistance: 120, equipmentPerLocation: [] }),
  search: async () => ({ equipment: [], loans: [] }),
  ...overrides,
});
const auth = (roles: string[]) => ({ getPublicConfig: async () => { throw new Error("not called"); }, authenticate: async () => ({ id: 7, name: "User", firstName: "Test", lastName: "User", email: "user@example.test", wannabeId: 70, roles }) });

test("makes the V1 dashboard available to every authenticated user", async () => {
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["bruker"]), dashboard: service() });
  const response = await app.inject({ method: "GET", url: "/api/v1/dashboard", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 200); assert.equal(response.json().activeLoans, 3); await app.close();
});

test("keeps global search limited to the four V1 roles", async () => {
  for (const role of ["developer", "chief", "co-chief", "logistikk"]) {
    let term = "";
    const app = buildApp({ checkDatabase: async () => undefined, auth: auth([role]), dashboard: service({ search: async (value) => { term = value; return { equipment: [], loans: [] }; } }) });
    const response = await app.inject({ method: "GET", url: "/api/v1/search?q=radio", headers: { authorization: "Bearer valid" } });
    assert.equal(response.statusCode, 200, role); assert.equal(term, "radio", role); await app.close();
  }
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["bruker"]), dashboard: service() });
  const response = await app.inject({ method: "GET", url: "/api/v1/search?q=radio", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 403); await app.close();
});
