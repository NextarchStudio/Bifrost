import { createHash, randomBytes } from "node:crypto";
import { localSessions, type DatabaseConnection } from "@bifrost/database";

export const LOCAL_SESSION_TOKEN_PREFIX = "bfl_";
export const LOCAL_SESSION_TTL_MS = 12 * 60 * 60 * 1_000;
export const SESSION_COOKIE_NAME = "bifrost_session";
export const SESSION_COOKIE_PATH = "/api";

export interface IssuedLocalSession {
  accessToken: string;
  expiresAt: Date;
}

export function issueLocalSessionToken(): string {
  return `${LOCAL_SESSION_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function isLocalSessionToken(token: string): boolean {
  return token.startsWith(LOCAL_SESSION_TOKEN_PREFIX);
}

export function hashLocalSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function issueStoredLocalSession(
  database: DatabaseConnection,
  userId: number,
  now = new Date(),
): Promise<IssuedLocalSession> {
  const accessToken = issueLocalSessionToken();
  const expiresAt = new Date(now.getTime() + LOCAL_SESSION_TTL_MS);
  await database.db.insert(localSessions).values({
    userId,
    tokenHash: hashLocalSessionToken(accessToken),
    expiresAt,
    lastSeenAt: now,
    createdAt: now,
  });
  return { accessToken, expiresAt };
}

export function readSessionCookie(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    const name = segment.slice(0, separator).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    try {
      const value = decodeURIComponent(segment.slice(separator + 1).trim());
      return isLocalSessionToken(value) ? value : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function serializeSessionCookie(token: string, expiresAt: Date, secure: boolean): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1_000));
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=${SESSION_COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
    `Expires=${expiresAt.toUTCString()}`,
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export function serializeClearedSessionCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    `Path=${SESSION_COOKIE_PATH}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}
