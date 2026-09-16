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
