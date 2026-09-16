import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const FORMAT_VERSION = "v1";

export interface EncryptedValue {
  ciphertext: string;
  keyVersion: number;
}

export function createMasterKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

export function encryptValue(plaintext: string, key: Buffer, keyVersion = 1): EncryptedValue {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: [FORMAT_VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join("."),
    keyVersion,
  };
}

export function decryptValue(value: EncryptedValue, keys: ReadonlyMap<number, Buffer>): string {
  const key = keys.get(value.keyVersion);
  if (!key) throw new Error(`Missing encryption key version ${value.keyVersion}`);
  assertKey(key);

  const [format, ivPart, tagPart, encryptedPart] = value.ciphertext.split(".");
  if (format !== FORMAT_VERSION || !ivPart || !tagPart || encryptedPart === undefined) {
    throw new Error("Unsupported encrypted value format");
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function assertKey(key: Buffer): void {
  if (key.length !== KEY_BYTES) throw new Error(`Encryption key must be ${KEY_BYTES} bytes`);
}
