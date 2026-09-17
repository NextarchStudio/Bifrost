import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../app.js";
import type { ConfidentialOidcService } from "./confidential-oidc.js";
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

test("completes confidential OIDC with an HttpOnly cookie and no token in the body", async () => {
  const browserBinding = "b".repeat(43);
  const oidc: ConfidentialOidcService = {
    start: async (input) => {
      assert.equal(input.origin, "https://tg.example.test");
      return { authorizationUrl: "https://sso.example.test/authorize?state=test", browserBinding, secureCookie: true };
    },
    complete: async (input, ipAddress, receivedBinding) => {
      assert.equal(input.code, "authorization-code");
      assert.equal(ipAddress, "127.0.0.1");
      assert.equal(receivedBinding, browserBinding);
      return {
        accessToken: "bfl_server-only-session",
        expiresAt: "2026-09-18T00:00:00.000Z",
        secureCookie: true,
        user: { id: 3, name: "SSO User", firstName: "SSO", lastName: "User", email: "sso@example.test", wannabeId: 1234, roles: ["bruker"] },
      };
    },
  };
  const app = buildApp({ checkDatabase: async () => undefined, auth, oidc });

  const start = await app.inject({ method: "POST", url: "/api/v1/auth/oidc/start", payload: { origin: "https://tg.example.test" } });
  assert.equal(start.statusCode, 200);
  assert.match(String(start.headers["set-cookie"]), /bifrost_oidc_flow=/);
  assert.match(String(start.headers["set-cookie"]), /HttpOnly/);
  assert.match(String(start.headers["set-cookie"]), /Secure/);

  const callback = await app.inject({
    method: "POST",
    url: "/api/v1/auth/oidc/callback",
    headers: { cookie: `bifrost_oidc_flow=${browserBinding}` },
    payload: { code: "authorization-code", state: "s".repeat(32) },
  });
  assert.equal(callback.statusCode, 200);
  assert.equal(callback.json().user.id, 3);
  assert.equal(callback.body.includes("bfl_server-only-session"), false);
  assert.match(String(callback.headers["set-cookie"]), /bifrost_session=bfl_server-only-session/);
  assert.match(String(callback.headers["set-cookie"]), /bifrost_oidc_flow=;/);
  assert.match(String(callback.headers["set-cookie"]), /HttpOnly/);
  assert.match(String(callback.headers["set-cookie"]), /Secure/);
  await app.close();
});

test("accepts the opaque SSO session cookie and requires CSRF protection for mutations", async () => {
  let authenticatedToken = "";
  const cookieAuth: AuthService = {
    getPublicConfig: auth.getPublicConfig,
    authenticate: async (token) => {
      authenticatedToken = token;
      return { id: 3, name: "SSO User", firstName: "SSO", lastName: "User", email: "sso@example.test", wannabeId: 1234, roles: ["bruker"] };
    },
  };
  const localAuth: LocalAuthService = {
    login: async () => { throw new Error("not called"); },
    logout: async () => undefined,
  };
  const app = buildApp({ checkDatabase: async () => undefined, auth: cookieAuth, localAuth });
  const me = await app.inject({ method: "GET", url: "/api/v1/me", headers: { cookie: "bifrost_session=bfl_cookie-session" } });
  assert.equal(me.statusCode, 200);
  assert.equal(authenticatedToken, "bfl_cookie-session");

  const rejectedLogout = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie: "bifrost_session=bfl_cookie-session" } });
  assert.equal(rejectedLogout.statusCode, 403);
  const logout = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie: "bifrost_session=bfl_cookie-session", "x-bifrost-request": "web" } });
  assert.equal(logout.statusCode, 204);
  assert.match(String(logout.headers["set-cookie"]), /Max-Age=0/);
  await app.close();
});
