import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../app.js";
import type { LocalAuthService } from "./local-login.js";
import { AuthenticationError, type AuthService } from "./service.js";

const auth: AuthService = {
  getPublicConfig: async () => ({
    authority: "https://id.example.test/realms/bifrost",
    clientId: "bifrost-web",
    redirectUri: "http://127.0.0.1:3000/auth/callback",
    scope: "openid profile email",
    localLoginEnabled: true,
  }),
  authenticate: async () => { throw new Error("not called"); },
};

test("completes local login without returning a password or token hash", async () => {
  const localAuth: LocalAuthService = {
    login: async (input, ipAddress) => {
      assert.deepEqual(input, { email: "local@example.test", password: "secret-password" });
      assert.equal(ipAddress, "127.0.0.1");
      return {
        accessToken: "bfl_opaque-token",
        expiresAt: "2026-09-17T17:00:00.000Z",
        user: { id: 2, name: "Local User", firstName: "Local", lastName: "User", email: input.email, wannabeId: null, roles: ["developer"] },
      };
    },
    logout: async () => undefined,
  };
  const app = buildApp({ checkDatabase: async () => undefined, auth, localAuth });
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/local",
    payload: { email: "local@example.test", password: "secret-password" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().accessToken, "bfl_opaque-token");
  assert.equal(response.json().user.id, 2);
  assert.doesNotMatch(response.body, /secret-password|tokenHash/);
  await app.close();
});

test("preserves local-login disablement and rate-limit errors", async () => {
  for (const [statusCode, message] of [[403, "Lokal innlogging er deaktivert."], [429, "For mange innloggingsforsøk."]] as const) {
    const localAuth: LocalAuthService = {
      login: async () => { throw new AuthenticationError(message, statusCode); },
      logout: async () => undefined,
    };
    const app = buildApp({ checkDatabase: async () => undefined, auth, localAuth });
    const response = await app.inject({ method: "POST", url: "/api/v1/auth/local", payload: { email: "local@example.test", password: "wrong" } });
    assert.equal(response.statusCode, statusCode);
    assert.equal(response.json().error.message, message);
    await app.close();
  }
});

test("revokes an opaque local session on logout", async () => {
  let revokedToken = "";
  const localAuth: LocalAuthService = {
    login: async () => { throw new Error("not called"); },
    logout: async (token) => { revokedToken = token; },
  };
  const app = buildApp({ checkDatabase: async () => undefined, auth, localAuth });
  const response = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { authorization: "Bearer bfl_opaque-token" } });
  assert.equal(response.statusCode, 204);
  assert.equal(revokedToken, "bfl_opaque-token");
  await app.close();
});
