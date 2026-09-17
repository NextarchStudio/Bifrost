import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../app.js";
import type { CommsService } from "./service.js";

const workspace = { items: [], sets: [], activeLoans: [] };
const serviceStub = (overrides: Partial<CommsService> = {}): CommsService => ({
  workspace: async () => workspace,
  createItem: async () => ({ id: 1 }),
  createSet: async () => ({ id: 1 }),
  updateSet: async () => undefined,
  deleteSet: async () => undefined,
  issue: async () => ({ loanId: 1 }),
  returnLoan: async () => undefined,
  ...overrides,
});

const auth = (roles: string[]) => ({
  getPublicConfig: async () => { throw new Error("not called"); },
  authenticate: async () => ({ id: 22, name: "Samband", firstName: "Sam", lastName: "Band", email: "samband@example.test", wannabeId: 220, roles }),
});

test("preserves sambandsansvarlig access to the comms workspace and crew lookup", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: auth(["sambandsansvarlig"]),
    comms: serviceStub(),
    crew: {
      lookup: async () => ({ id: 123, name: "Radio Bruker", nickname: "Radio", crewName: "Samband", role: "Crew", displayName: "Radio Bruker", source: "cache" }),
      picture: async () => null,
    },
  });
  const comms = await app.inject({ method: "GET", url: "/api/v1/comms", headers: { authorization: "Bearer valid" } });
  const lookup = await app.inject({ method: "GET", url: "/api/v1/crew/lookup?query=BADGE", headers: { authorization: "Bearer valid" } });
  assert.equal(comms.statusCode, 200);
  assert.equal(lookup.statusCode, 200);
  assert.equal(lookup.json().id, 123);
  await app.close();
});

test("creates a set with actor context", async () => {
  let actorId = 0;
  let selectedQuantity = 0;
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: auth(["logistikk"]),
    comms: serviceStub({ createSet: async (input, actor) => { actorId = actor; selectedQuantity = input.items[0]?.quantity ?? 0; return { id: 9 }; } }),
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/comms/sets",
    headers: { authorization: "Bearer valid" },
    payload: { name: "Sett A", items: [{ itemId: 3, quantity: 2 }] },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().id, 9);
  assert.equal(actorId, 22);
  assert.equal(selectedQuantity, 2);
  await app.close();
});

test("issues and partially returns comms equipment", async () => {
  let issuedWannabeId = 0;
  let returnedQuantity = 0;
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: auth(["sambandsansvarlig"]),
    comms: serviceStub({
      issue: async (input) => { issuedWannabeId = input.wannabeId; return { loanId: 14 }; },
      returnLoan: async (_id, input) => { returnedQuantity = input.returns[0]?.quantity ?? 0; },
    }),
  });
  const issue = await app.inject({ method: "POST", url: "/api/v1/comms/loans", headers: { authorization: "Bearer valid" }, payload: { wannabeId: 991, loanType: "item", itemId: 4, quantity: 2 } });
  const returned = await app.inject({ method: "POST", url: "/api/v1/comms/loans/14/return", headers: { authorization: "Bearer valid" }, payload: { returns: [{ itemId: 4, quantity: 1 }], replacementItemId: null, replacementQuantity: 0 } });
  assert.equal(issue.statusCode, 201);
  assert.equal(issue.json().loanId, 14);
  assert.equal(returned.statusCode, 204);
  assert.equal(issuedWannabeId, 991);
  assert.equal(returnedQuantity, 1);
  await app.close();
});

test("denies comms access to unrelated V1 roles", async () => {
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["shop"]), comms: serviceStub() });
  const response = await app.inject({ method: "GET", url: "/api/v1/comms", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN");
  await app.close();
});

test("rejects duplicate return lines", async () => {
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["logistikk"]), comms: serviceStub() });
  const response = await app.inject({ method: "POST", url: "/api/v1/comms/loans/14/return", headers: { authorization: "Bearer valid" }, payload: { returns: [{ itemId: 4, quantity: 1 }, { itemId: 4, quantity: 1 }] } });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "INVALID_BODY");
  await app.close();
});
