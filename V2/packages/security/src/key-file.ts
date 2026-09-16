import { chmod, mkdir, open, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createMasterKey } from "./encryption.js";

export async function loadOrCreateKeyFile(filePath: string): Promise<Buffer> {
  try {
    return decodeKey(await readFile(filePath, "utf8"));
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }

  await mkdir(dirname(filePath), { recursive: true });
  const key = createMasterKey();
  try {
    const handle = await open(filePath, "wx", 0o600);
    try {
      await handle.writeFile(`${key.toString("base64url")}\n`, "utf8");
    } finally {
      await handle.close();
    }
    await chmod(filePath, 0o600).catch(() => undefined);
    return key;
  } catch (error) {
    if (!isExistingFile(error)) throw error;
    return decodeKey(await readFile(filePath, "utf8"));
  }
}

function decodeKey(value: string): Buffer {
  const key = Buffer.from(value.trim(), "base64url");
  if (key.length !== 32) throw new Error("Master key file must contain a 32-byte base64url key");
  return key;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isExistingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}
