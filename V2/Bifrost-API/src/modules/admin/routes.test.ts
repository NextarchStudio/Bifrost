import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../app.js";
import type { AdminService } from "./service.js";

const workspace = { canManageSettings: false, crewCacheEntries: 0, roles: [], users: [], settings: null };
const serviceStub = (overrides: Partial<AdminService> = {}): AdminService => ({
  workspace: async () => workspace,
  statistics: async () => ({ users: { total: 0, active: 0, inactive: 0, withWannabeId: 0, withBadgeScan: 0, cached: 0 }, roles: [], feedback: { total: 0, pending: 0, approved: 0, onHold: 0, inProgress: 0, implemented: 0, fixed: 0, completedTotal: 0, rejected: 0, needsDatabaseFix: 0, featureTotal: 0, bugTotal: 0 }, equipment: { totalItems: 0, totalQuantity: 0, availableQuantity: 0, loanedQuantity: 0, maintenanceQuantity: 0, activeLoans: 0, loanedOutQuantity: 0, returnedLoans: 0, returnedQuantity: 0, loanEventsTotal: 0, categories: [] }, comms: { totalItems: 0, totalQuantity: 0, availableQuantity: 0, loanedQuantity: 0, totalSets: 0, activeLoans: 0, returnedLoans: 0, loanedOutQuantity: 0, returnedQuantity: 0, loanEventsTotal: 0, types: [] }, vehicles: { total: 0, available: 0, loaned: 0, maintenance: 0, activeLoans: 0, returnedLoans: 0, loanEventsTotal: 0, assignedTransportJobs: 0 }, requests: { total: 0, pending: 0, partial: 0, fulfilled: 0, returned: 0, rejected: 0, requestedQuantity: 0, requestLines: 0 }, transport: { total: 0, open: 0, assigned: 0, inProgress: 0, completed: 0, peopleTransport: 0, equipmentTransport: 0 }, tasks: { total: 0, notStarted: 0, inProgress: 0, blocked: 0, completed: 0, linkedToTransport: 0 }, shop: { categories: 0, items: 0, totalQuantity: 0, checkoutCount: 0, checkoutQuantity: 0, checkinCount: 0, checkinQuantity: 0, movementsTotal: 0 }, privateEquipment: { prefixRules: 0 }, locations: { total: 0, withAddress: 0, types: [] }, warehouse: { pallets: 0, slots: 0, occupiedSlots: 0 } }),
  crewResetPreview: async () => ({ confirmationPhrase: "SLETT CREW-CACHE OG BRUKERE", preservedUser: { id: 2, name: "Protected", email: "protected@example.test" }, deletes: { users: 0, crewCache: 0, competencies: 0, vehicleKdo: 0, passwordResetTokens: 0, feedbackNotificationReads: 0, feedbackEntries: 0, tasks: 0, authAccounts: 0, userRoles: 0, equipmentRequests: 0, equipmentLoans: 0, commsLoans: 0, vehicleLoans: 0, shopMovements: 0, auditLogs: 0, loginAttempts: 0 }, unlinks: { transportRequesters: 0, transportAssignees: 0 }, clearsProtectedUserBadge: true, cacheYear: 2026 }),
  clearCrewCache: async () => serviceStub().crewResetPreview(),
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

test("keeps V1 statistics available to the same three administration roles", async () => {
  for (const role of ["developer", "chief", "co-chief"]) {
    let called = false;
    const app = buildApp({ checkDatabase: async () => undefined, auth: auth([role]), admin: serviceStub({ statistics: async () => { called = true; return serviceStub().statistics(); } }) });
    const response = await app.inject({ method: "GET", url: "/api/v1/admin/statistics", headers: { authorization: "Bearer valid" } });
    assert.equal(response.statusCode, 200, role); assert.equal(called, true, role); await app.close();
  }
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["logistikk"]), admin: serviceStub() });
  const response = await app.inject({ method: "GET", url: "/api/v1/admin/statistics", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 403); await app.close();
});

test("only developer can update secure system settings", async () => {
  const payload = { appName: "Bifrost", localLoginEnabled: true, webOrigins: ["https://bifrost.tg.no"], keycloakBaseUrl: "https://id.example.test", keycloakRealm: "crew", keycloakClientId: "bifrost", keycloakRedirectUri: "https://bifrost.tg.no/auth/callback" };
  const deniedApp = buildApp({ checkDatabase: async () => undefined, auth: auth(["chief"]), admin: serviceStub() });
  const denied = await deniedApp.inject({ method: "PUT", url: "/api/v1/admin/settings", headers: { authorization: "Bearer valid" }, payload });
  assert.equal(denied.statusCode, 403); await deniedApp.close();
  let actorId = 0;
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["developer"]), admin: serviceStub({ updateSettings: async (_input, actor) => { actorId = actor; } }) });
  const response = await app.inject({ method: "PUT", url: "/api/v1/admin/settings", headers: { authorization: "Bearer valid" }, payload });
  assert.equal(response.statusCode, 204); assert.equal(actorId, 5); await app.close();
});

test("protects destructive crew reset with developer role and exact confirmation", async () => {
  const deniedApp = buildApp({ checkDatabase: async () => undefined, auth: auth(["chief"]), admin: serviceStub() });
  const denied = await deniedApp.inject({ method: "GET", url: "/api/v1/admin/crew-cache/preview", headers: { authorization: "Bearer valid" } });
  assert.equal(denied.statusCode, 403); await deniedApp.close();

  let actorId = 0;
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["developer"]), admin: serviceStub({ clearCrewCache: async (_confirmation, actor) => { actorId = actor; return serviceStub().crewResetPreview(); } }) });
  const invalid = await app.inject({ method: "POST", url: "/api/v1/admin/crew-cache/clear", headers: { authorization: "Bearer valid" }, payload: { confirmation: "slett" } });
  const valid = await app.inject({ method: "POST", url: "/api/v1/admin/crew-cache/clear", headers: { authorization: "Bearer valid" }, payload: { confirmation: "SLETT CREW-CACHE OG BRUKERE" } });
  assert.equal(invalid.statusCode, 400); assert.equal(valid.statusCode, 200); assert.equal(actorId, 5); await app.close();
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
