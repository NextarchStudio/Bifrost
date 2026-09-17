import assert from "node:assert/strict";
import test from "node:test";
import type { CurrentUser, OidcPublicConfig } from "@bifrost/contracts";
import type { SecureSettingsStore } from "../settings/secure-settings.js";
import type { AuthLoginService } from "./login-audit.js";
import { AuthenticationError, type AuthService } from "./service.js";
import { createConfidentialOidcService } from "./confidential-oidc.js";

const config: OidcPublicConfig = {
  authority: "https://sso.example.test/realms/wannabe",
  clientId: "bifrost-confidential",
  redirectUri: "https://tg.example.test/auth/callback",
  scope: "openid profile email",
};
const user: CurrentUser = {
  id: 7,
  name: "OIDC User",
  firstName: "OIDC",
  lastName: "User",
  email: "oidc@example.test",
  wannabeId: 12345,
  roles: ["logistikk"],
};

test("uses PKCE and exchanges a confidential code without returning Keycloak tokens", async () => {
  const auth: AuthService = {
    getPublicConfig: async (origin) => {
      assert.equal(origin, "https://tg.example.test");
      return config;
    },
    authenticate: async () => user,
  };
  let auditedToken = "";
  const login: AuthLoginService = {
    complete: async (token) => {
      auditedToken = token;
      return user;
    },
  };
  const secrets: SecureSettingsStore = {
    get: async (key) => key === "oidc.client_secret" ? "server-only-secret" : null,
    set: async () => undefined,
  };
  let expectedNonce = "";
  let exchangedBody = "";
  const service = createConfidentialOidcService(
    auth,
    login,
    secrets,
    async () => ({ accessToken: "bfl_opaque-session", expiresAt: new Date("2026-09-18T00:00:00.000Z") }),
    {
      fetchImplementation: async (_input, init) => {
        exchangedBody = String(init?.body);
        return new Response(JSON.stringify({ id_token: "signed-id-token", access_token: "must-not-leave-api", refresh_token: "must-not-leave-api" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      verifyIdToken: async (token) => {
        assert.equal(token, "signed-id-token");
        return { sub: "subject-7", nonce: expectedNonce };
      },
      now: () => new Date("2026-09-17T12:00:00.000Z"),
    },
  );

  const started = await service.start({ origin: "https://tg.example.test" });
  const authorizationUrl = new URL(started.authorizationUrl);
  const state = authorizationUrl.searchParams.get("state");
  expectedNonce = authorizationUrl.searchParams.get("nonce") ?? "";
  assert.ok(state);
  assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
  assert.match(authorizationUrl.searchParams.get("code_challenge") ?? "", /^[A-Za-z0-9_-]{43}$/);
  assert.match(started.browserBinding, /^[A-Za-z0-9_-]{43}$/);

  await assert.rejects(
    () => service.complete({ code: "one-time-code", state }, "127.0.0.1"),
    (error: unknown) => error instanceof AuthenticationError && /denne nettleseren/.test(error.message),
  );

  const completed = await service.complete({ code: "one-time-code", state }, "127.0.0.1", started.browserBinding);
  assert.equal(completed.user.id, 7);
  assert.equal(completed.accessToken, "bfl_opaque-session");
  assert.equal(completed.secureCookie, true);
  assert.equal("id_token" in completed, false);
  assert.equal("refresh_token" in completed, false);
  assert.equal(auditedToken, "signed-id-token");

  const tokenRequest = new URLSearchParams(exchangedBody);
  assert.equal(tokenRequest.get("client_secret"), "server-only-secret");
  assert.equal(tokenRequest.get("code"), "one-time-code");
  assert.ok(tokenRequest.get("code_verifier"));

  await assert.rejects(
    () => service.complete({ code: "replayed-code", state }, "127.0.0.1", started.browserBinding),
    (error: unknown) => error instanceof AuthenticationError && /allerede brukt/.test(error.message),
  );
});

test("refuses to start confidential OIDC without an encrypted client secret", async () => {
  const service = createConfidentialOidcService(
    { getPublicConfig: async () => config, authenticate: async () => user },
    { complete: async () => user },
    { get: async () => null, set: async () => undefined },
    async () => ({ accessToken: "never", expiresAt: new Date() }),
  );
  await assert.rejects(
    () => service.start({ origin: "https://tg.example.test" }),
    (error: unknown) => error instanceof AuthenticationError && error.statusCode === 503,
  );
});
