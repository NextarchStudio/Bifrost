import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../app.js";
import type { TaskService } from "./service.js";

const workspace = { canManageAll: false, currentUserId: 5, myTasks: [], allTasks: [], users: [], transportJobs: [] };
const serviceStub = (overrides: Partial<TaskService> = {}): TaskService => ({
  workspace: async () => workspace,
  create: async () => ({ id: 1 }),
  updateStatus: async () => undefined,
  ...overrides,
});
const auth = (roles: string[]) => ({
  getPublicConfig: async () => { throw new Error("not called"); },
  authenticate: async () => ({ id: 5, name: "Bruker", firstName: "Vanlig", lastName: "Bruker", email: "user@example.test", wannabeId: 50, roles }),
});

test("lets every authenticated V1 user see their own tasks", async () => {
  let actorId = 0; let canManage = true;
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["bruker"]), tasks: serviceStub({ workspace: async (id, can) => { actorId = id; canManage = can; return workspace; } }) });
  const response = await app.inject({ method: "GET", url: "/api/v1/tasks", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 200);
  assert.equal(actorId, 5);
  assert.equal(canManage, false);
  await app.close();
});

test("allows an assignee to update status without manager privileges", async () => {
  let captured: unknown[] = [];
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["bruker"]), tasks: serviceStub({ updateStatus: async (...args) => { captured = args; } }) });
  const response = await app.inject({ method: "PATCH", url: "/api/v1/tasks/9/status", headers: { authorization: "Bearer valid" }, payload: { status: "completed" } });
  assert.equal(response.statusCode, 204);
  assert.deepEqual(captured, [9, "completed", 5, false]);
  await app.close();
});

test("restricts task creation to the four V1 manager roles", async () => {
  const deniedApp = buildApp({ checkDatabase: async () => undefined, auth: auth(["bruker"]), tasks: serviceStub() });
  const payload = { title: "Flytt utstyr", type: "work", status: "not_started", priority: 2, description: "Flytt dette til lageret", assignedUserId: 5, dueAt: "2026-09-18T12:00:00" };
  const denied = await deniedApp.inject({ method: "POST", url: "/api/v1/tasks", headers: { authorization: "Bearer valid" }, payload });
  assert.equal(denied.statusCode, 403);
  await deniedApp.close();
  for (const role of ["developer", "chief", "co-chief", "logistikk"]) {
    const app = buildApp({ checkDatabase: async () => undefined, auth: auth([role]), tasks: serviceStub({ create: async () => ({ id: 12 }) }) });
    const response = await app.inject({ method: "POST", url: "/api/v1/tasks", headers: { authorization: "Bearer valid" }, payload });
    assert.equal(response.statusCode, 201, role);
    await app.close();
  }
});

test("rejects invalid task statuses", async () => {
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["bruker"]), tasks: serviceStub() });
  const response = await app.inject({ method: "PATCH", url: "/api/v1/tasks/9/status", headers: { authorization: "Bearer valid" }, payload: { status: "deleted" } });
  assert.equal(response.statusCode, 400);
  await app.close();
});
