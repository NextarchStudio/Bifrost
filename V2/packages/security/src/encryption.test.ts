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
  const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -1)}A` };
  assert.throws(() => decryptValue(tampered, new Map([[1, key]])));
});
