import { createHash, randomBytes } from "node:crypto";

export const LOCAL_SESSION_TOKEN_PREFIX = "bfl_";
export const LOCAL_SESSION_TTL_MS = 12 * 60 * 60 * 1_000;

export function issueLocalSessionToken(): string {
  return `${LOCAL_SESSION_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function isLocalSessionToken(token: string): boolean {
  return token.startsWith(LOCAL_SESSION_TOKEN_PREFIX);
}

export function hashLocalSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
