import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../app.js";
import type { AdminService } from "./service.js";

const workspace = { canManageSettings: false, crewCacheEntries: 0, roles: [], users: [], settings: null };
const serviceStub = (overrides: Partial<AdminService> = {}): AdminService => ({
  workspace: async () => workspace,
  createUser: async () => ({ id: 1 }), setUserActive: async () => undefined, syncUserRoles: async () => undefined,
  updateUserCompetencies: async () => undefined, deleteUser: async () => undefined,
  createRole: async () => ({ id: 1 }), updateRole: async () => undefined, deleteRole: async () => undefined,
  updateSettings: async () => undefined, ...overrides,
});
const auth = (roles: string[]) => ({ getPublicConfig: async () => { throw new Error("not called"); }, authenticate: async () => ({ id: 5, name: "Admin", firstName: "Test", lastName: "Admin", email: "admin@example.test", wannabeId: 50, roles }) });

test("keeps V1 administration limited to developer, chief and co-chief", async () => {
  for (const role of ["developer", "chief", "co-chief"]) {
    const app = buildApp({ checkDatabase: async () => undefined, auth: auth([role]), admin: serviceStub() });
    const response = await app.inject({ method: "GET", url: "/api/v1/admin", headers: { authorization: "Bearer valid" } });
    assert.equal(response.statusCode, 200, role); await app.close();
  }
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["logistikk"]), admin: serviceStub() });
  const response = await app.inject({ method: "GET", url: "/api/v1/admin", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 403); await app.close();
});

test("only developer can update secure system settings", async () => {
  const payload = { appName: "Bifrost", keycloakBaseUrl: "https://id.example.test", keycloakRealm: "crew", keycloakClientId: "bifrost", keycloakRedirectUri: "https://bifrost.example.test/auth/callback" };
  const deniedApp = buildApp({ checkDatabase: async () => undefined, auth: auth(["chief"]), admin: serviceStub() });
  const denied = await deniedApp.inject({ method: "PUT", url: "/api/v1/admin/settings", headers: { authorization: "Bearer valid" }, payload });
  assert.equal(denied.statusCode, 403); await deniedApp.close();
  let actorId = 0;
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["developer"]), admin: serviceStub({ updateSettings: async (_input, actor) => { actorId = actor; } }) });
  const response = await app.inject({ method: "PUT", url: "/api/v1/admin/settings", headers: { authorization: "Bearer valid" }, payload });
  assert.equal(response.statusCode, 204); assert.equal(actorId, 5); await app.close();
});

test("creates an OIDC-provisioned user with actor context", async () => {
  let captured: unknown[] = [];
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["chief"]), admin: serviceStub({ createUser: async (...args) => { captured = args; return { id: 8 }; } }) });
  const response = await app.inject({ method: "POST", url: "/api/v1/admin/users", headers: { authorization: "Bearer valid" }, payload: { firstName: "Ola", lastName: "Nordmann", email: "ola@example.test", wannabeId: 1234 } });
  assert.equal(response.statusCode, 201); assert.equal((captured[0] as { email: string }).email, "ola@example.test"); assert.equal(captured[1], 5); await app.close();
});

test("validates role and competency mutations", async () => {
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["co-chief"]), admin: serviceStub() });
  const badRole = await app.inject({ method: "PUT", url: "/api/v1/admin/users/3/roles", headers: { authorization: "Bearer valid" }, payload: { roleIds: [0] } });
  const badCompetency = await app.inject({ method: "PUT", url: "/api/v1/admin/users/3/competencies", headers: { authorization: "Bearer valid" }, payload: { competencies: ["truck"] } });
  assert.equal(badRole.statusCode, 400); assert.equal(badCompetency.statusCode, 400); await app.close();
});
