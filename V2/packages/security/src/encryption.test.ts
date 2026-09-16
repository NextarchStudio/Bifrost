import assert from "node:assert/strict";
import test from "node:test";
import { createMasterKey, decryptValue, encryptValue } from "./encryption.js";

test("encrypts and decrypts a setting", () => {
  const key = createMasterKey();
  const encrypted = encryptValue("keycloak-secret", key, 3);
  assert.notEqual(encrypted.ciphertext, "keycloak-secret");
  assert.equal(decryptValue(encrypted, new Map([[3, key]])), "keycloak-secret");
});

test("rejects tampered ciphertext", () => {
  const key = createMasterKey();
  const encrypted = encryptValue("secret", key);
  const parts = encrypted.ciphertext.split(".");
  const ciphertext = Buffer.from(parts[3]!, "base64url");
  ciphertext[0] = ciphertext[0]! ^ 0xff;
  parts[3] = ciphertext.toString("base64url");
  const tampered = { ...encrypted, ciphertext: parts.join(".") };
  assert.throws(() => decryptValue(tampered, new Map([[1, key]])));
});
