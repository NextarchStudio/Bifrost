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
