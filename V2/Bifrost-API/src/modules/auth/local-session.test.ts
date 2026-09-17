import assert from "node:assert/strict";
import test from "node:test";
import { hashLocalSessionToken, isLocalSessionToken, issueLocalSessionToken } from "./local-session.js";

test("issues opaque local tokens and stores only deterministic SHA-256 hashes", () => {
  const first = issueLocalSessionToken();
  const second = issueLocalSessionToken();

  assert.equal(isLocalSessionToken(first), true);
  assert.equal(isLocalSessionToken("eyJhbGciOiJSUzI1NiJ9.payload.signature"), false);
  assert.notEqual(first, second);
  assert.match(hashLocalSessionToken(first), /^[a-f0-9]{64}$/);
  assert.equal(hashLocalSessionToken(first), hashLocalSessionToken(first));
  assert.doesNotMatch(hashLocalSessionToken(first), new RegExp(first));
});
