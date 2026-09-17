import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../app.js";
import type { TransportService } from "./service.js";

const emptyWorkspace = {
  canManage: true,
  canRequestPeople: false,
  locations: [],
  transportLocations: [],
  users: [],
  vehicles: [],
  activeJobs: [],
  completedJobs: [],
};

const serviceStub = (overrides: Partial<TransportService> = {}): TransportService => ({
  workspace: async () => emptyWorkspace,
  inspect: async () => { throw new Error("not called"); },
  create: async () => ({ id: 1 }),
  requestPeople: async () => ({ id: 2 }),
  assign: async () => undefined,
  start: async () => undefined,
  complete: async () => undefined,
  ...overrides,
});

const authenticated = (roles: string[]) => ({
  getPublicConfig: async () => { throw new Error("not called"); },
  authenticate: async () => ({ id: 17, name: "Test", firstName: "Test", lastName: "Bruker", email: "test@example.test", wannabeId: 170, roles }),
});

test("lets logistics open and manage the transport workspace", async () => {
  let actorId = 0;
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: authenticated(["logistikk"]),
    transport: serviceStub({ assign: async (_id, _assignee, actor) => { actorId = actor; } }),
  });
  const workspace = await app.inject({ method: "GET", url: "/api/v1/transport", headers: { authorization: "Bearer valid" } });
  const assigned = await app.inject({ method: "POST", url: "/api/v1/transport/4/assign", headers: { authorization: "Bearer valid" }, payload: { assignedUserId: 9 } });
  assert.equal(workspace.statusCode, 200);
  assert.equal(assigned.statusCode, 204);
  assert.equal(actorId, 17);
  await app.close();
});

test("lets innkjop request people transport but not create logistics jobs", async () => {
  let requesterId = 0;
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: authenticated(["innkjop"]),
    transport: serviceStub({ requestPeople: async (_input, user) => { requesterId = user.id; return { id: 8 }; } }),
  });
  const request = await app.inject({
    method: "POST",
    url: "/api/v1/transport/people-requests",
    headers: { authorization: "Bearer valid" },
    payload: { fromLocationId: 1, toLocationId: 2, peopleCount: 4, pickupAt: "2026-09-17T18:30:00+02:00" },
  });
  const create = await app.inject({
    method: "POST",
    url: "/api/v1/transport",
    headers: { authorization: "Bearer valid" },
    payload: { description: "Utstyr", fromLocationId: 1, toLocationId: 2, vehicleId: 3, jobKind: "equipment", requesterWannabeId: 170, stops: [] },
  });
  assert.equal(request.statusCode, 201);
  assert.equal(request.json().id, 8);
  assert.equal(requesterId, 17);
  assert.equal(create.statusCode, 403);
  await app.close();
});

test("keeps transport unavailable to unrelated V1 roles", async () => {
  const app = buildApp({ checkDatabase: async () => undefined, auth: authenticated(["bruker"]), transport: serviceStub() });
  const response = await app.inject({ method: "GET", url: "/api/v1/transport", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN");
  await app.close();
});

test("validates odometer input before starting a job", async () => {
  const app = buildApp({ checkDatabase: async () => undefined, auth: authenticated(["logistikk"]), transport: serviceStub() });
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/transport/3/start",
    headers: { authorization: "Bearer valid" },
    payload: { startOdometer: -1 },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "INVALID_BODY");
  await app.close();
});
