import assert from "node:assert/strict";
import test from "node:test";
import {
  hashLocalSessionToken,
  isLocalSessionToken,
  issueLocalSessionToken,
  readSessionCookie,
  serializeClearedSessionCookie,
  serializeSessionCookie,
} from "./local-session.js";

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

test("serializes an HttpOnly host cookie and reads only Bifrost session tokens", () => {
  const token = issueLocalSessionToken();
  const cookie = serializeSessionCookie(token, new Date(Date.now() + 60_000), true);
  assert.match(cookie, /Path=\/api/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.equal(readSessionCookie(`theme=dark; ${cookie.split(";")[0]}`), token);
  assert.equal(readSessionCookie("bifrost_session=not-a-bifrost-token"), undefined);
  assert.match(serializeClearedSessionCookie(true), /Max-Age=0/);
});
