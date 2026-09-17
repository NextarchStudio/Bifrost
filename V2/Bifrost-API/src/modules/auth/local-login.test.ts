import assert from "node:assert/strict";
import test from "node:test";
import { verifyLegacyPassword } from "./local-login.js";

const PHP_ARGON2ID_HASH = "$argon2id$v=19$m=65536,t=4,p=1$ZmFlaldCQ25BVEY1MGxhRw$yen/KbSOkpIFPdLWpwednSDB+eIBgCuAtSUqiiCLQO0";

test("verifies V1 PHP Argon2id password hashes", async () => {
  assert.equal(await verifyLegacyPassword(PHP_ARGON2ID_HASH, "CorrectHorse-2026!"), true);
  assert.equal(await verifyLegacyPassword(PHP_ARGON2ID_HASH, "wrong-password"), false);
});
