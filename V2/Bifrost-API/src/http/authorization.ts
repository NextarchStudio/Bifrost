import { BIFROST_ACCESS, type CurrentUser } from "@bifrost/contracts";
import type { FastifyRequest } from "fastify";
import { readSessionCookie } from "../modules/auth/local-session.js";
import { AuthenticationError, type AuthService } from "../modules/auth/service.js";

export const LOGISTICS_ROLES = BIFROST_ACCESS.logistics;

export async function requireAuthenticated(request: FastifyRequest, auth: AuthService): Promise<CurrentUser> {
  return auth.authenticate(authenticationTokenFromRequest(request));
}

export function authenticationTokenFromRequest(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);

  const cookieToken = readSessionCookie(request.headers.cookie);
  if (!cookieToken) throw new AuthenticationError("Gyldig innlogging kreves.");
  if (!new Set(["GET", "HEAD", "OPTIONS"]).has(request.method) && request.headers["x-bifrost-request"] !== "web") {
    throw new AuthenticationError("Forespørselen mangler CSRF-beskyttelse.", 403);
  }
  return cookieToken;
}

export async function requireRoleAccess(
  request: FastifyRequest,
  auth: AuthService,
  allowedRoles: ReadonlySet<string>,
  forbiddenMessage: string,
): Promise<CurrentUser> {
  const user = await requireAuthenticated(request, auth);
  if (!user.roles.some((role) => allowedRoles.has(role))) throw new AuthenticationError(forbiddenMessage, 403);
  return user;
}

export function authenticationErrorCode(error: AuthenticationError): "UNAUTHORIZED" | "FORBIDDEN" | "RATE_LIMITED" | "OIDC_NOT_CONFIGURED" {
  if (error.statusCode === 403) return "FORBIDDEN";
  if (error.statusCode === 429) return "RATE_LIMITED";
  if (error.statusCode === 503) return "OIDC_NOT_CONFIGURED";
  return "UNAUTHORIZED";
}
