import assert from "node:assert/strict";
import test from "node:test";
import type { CurrentUser } from "@bifrost/contracts";
import type { DatabaseConnection } from "@bifrost/database";
import { AuthenticationError, type AuthService } from "./service.js";
import { createAuthLoginService, normalizeIpAddress } from "./login-audit.js";

const currentUser: CurrentUser = {
  id: 42,
  name: "Test User",
  firstName: "Test",
  lastName: "User",
  email: "test@example.test",
  wannabeId: 12345,
  roles: ["bruker"],
};

test("normalizes login IP addresses to the V1 column limit", () => {
  assert.equal(normalizeIpAddress(" 127.0.0.1 "), "127.0.0.1");
  assert.equal(normalizeIpAddress(" "), "unknown");
  assert.equal(normalizeIpAddress("x".repeat(60)), "x".repeat(45));
});

test("records a successful OIDC callback without storing the token", async () => {
  const { database, writes } = createDatabaseRecorder();
  const auth = authStub(async (token) => {
    assert.equal(token, "secret-access-token");
    return currentUser;
  });

  const user = await createAuthLoginService(database, auth).complete("secret-access-token", "127.0.0.1");

  assert.deepEqual(user, currentUser);
  assert.equal(writes.length, 2);
  assert.equal(writes[0]?.successful, true);
  assert.equal(writes[0]?.email, currentUser.email);
  assert.equal(writes[1]?.action, "login");
  assert.equal(writes[1]?.actorUserId, currentUser.id);
  assert.doesNotMatch(JSON.stringify(writes), /secret-access-token/);
});

test("records a rejected bearer token as an anonymous OIDC attempt", async () => {
  const { database, writes } = createDatabaseRecorder();
  const auth = authStub(async () => { throw new AuthenticationError("Ugyldig token."); });

  await assert.rejects(
    createAuthLoginService(database, auth).complete("rejected-secret-token", "2001:db8::1"),
    /Ugyldig token/,
  );

  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], {
    email: "oidc:unknown",
    ipAddress: "2001:db8::1",
    successful: false,
    createdAt: writes[0]?.createdAt,
  });
  assert.doesNotMatch(JSON.stringify(writes), /rejected-secret-token/);
});

test("rate limits rejected OIDC attempts using the V1 threshold", async () => {
  const { database, writes } = createDatabaseRecorder(5);
  const auth = authStub(async () => { throw new AuthenticationError("Ugyldig token."); });

  await assert.rejects(
    createAuthLoginService(database, auth).complete("another-secret-token", "192.0.2.50"),
    (error: unknown) => error instanceof AuthenticationError && error.statusCode === 429,
  );
  assert.equal(writes.length, 0);
});

test("does not count an OIDC service outage as a failed user attempt", async () => {
  const { database, writes } = createDatabaseRecorder();
  const auth = authStub(async () => { throw new AuthenticationError("OIDC utilgjengelig.", 503); });

  await assert.rejects(
    createAuthLoginService(database, auth).complete("unavailable-secret-token", "192.0.2.51"),
    (error: unknown) => error instanceof AuthenticationError && error.statusCode === 503,
  );
  assert.equal(writes.length, 0);
});

function authStub(authenticate: AuthService["authenticate"]): AuthService {
  return {
    getPublicConfig: async () => { throw new Error("not called"); },
    authenticate,
  };
}

function createDatabaseRecorder(failedAttempts = 0): { database: DatabaseConnection; writes: Array<Record<string, unknown>> } {
  const writes: Array<Record<string, unknown>> = [];
  const insert = () => ({
    values: async (values: Record<string, unknown>) => {
      writes.push(values);
    },
  });
  const database = {
    db: {
      insert,
      select: () => ({
        from: () => ({
          where: async () => [{ total: failedAttempts }],
        }),
      }),
      transaction: async (callback: (tx: { insert: typeof insert }) => Promise<void>) => callback({ insert }),
    },
  } as unknown as DatabaseConnection;
  return { database, writes };
}
