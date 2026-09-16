import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "./app.js";

test("health returns API status", async () => {
  const app = buildApp({ checkDatabase: async () => undefined });
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "ok");
  await app.close();
});

test("ready reports unavailable database", async () => {
  const app = buildApp({ checkDatabase: async () => { throw new Error("offline"); } });
  const response = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().database, "unavailable");
  await app.close();
});

test("publishes OIDC configuration without authentication", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => ({
        authority: "https://id.example.test/realms/bifrost",
        clientId: "bifrost-web",
        redirectUri: "http://localhost:3000/auth/callback",
        scope: "openid profile email",
      }),
      authenticate: async () => { throw new Error("not called"); },
    },
  });
  const response = await app.inject({ method: "GET", url: "/api/v1/auth/config" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().clientId, "bifrost-web");
  await app.close();
});

test("protects current-user endpoint with a bearer token", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => { throw new Error("not called"); },
    },
  });
  const response = await app.inject({ method: "GET", url: "/api/v1/me" });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "UNAUTHORIZED");
  await app.close();
});

test("lists equipment for an authorized logistics user", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({
        id: 1,
        name: "Logistikk Bruker",
        firstName: "Logistikk",
        lastName: "Bruker",
        email: "logistikk@example.test",
        wannabeId: null,
        roles: ["logistikk"],
      }),
    },
    equipment: {
      list: async (query) => ({ items: [], pagination: { ...query, total: 0, pageCount: 0 } }),
      create: async () => ({ id: 1, merged: false }),
    },
  });
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/equipment?page=2&pageSize=10",
    headers: { authorization: "Bearer valid" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().pagination.page, 2);
  await app.close();
});

test("denies equipment to users without a logistics role", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({
        id: 2,
        name: "Vanlig Bruker",
        firstName: "Vanlig",
        lastName: "Bruker",
        email: "bruker@example.test",
        wannabeId: null,
        roles: ["bruker"],
      }),
    },
    equipment: {
      list: async () => { throw new Error("not called"); },
      create: async () => { throw new Error("not called"); },
    },
  });
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/equipment",
    headers: { authorization: "Bearer valid" },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN");
  await app.close();
});

test("creates equipment for an authorized user", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({
        id: 7,
        name: "Lager Bruker",
        firstName: "Lager",
        lastName: "Bruker",
        email: "lager@example.test",
        wannabeId: null,
        roles: ["logistikk"],
      }),
    },
    equipment: {
      list: async () => { throw new Error("not called"); },
      create: async (_input, actorUserId) => ({ id: actorUserId, merged: false }),
    },
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/equipment",
    headers: { authorization: "Bearer valid" },
    payload: { name: "Kabel", category: "Kabel", serialNumber: "KB-100", quantity: 4 },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().id, 7);
  await app.close();
});
