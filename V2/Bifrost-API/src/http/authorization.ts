import type { CurrentUser } from "@bifrost/contracts";
import type { FastifyRequest } from "fastify";
import { AuthenticationError, type AuthService } from "../modules/auth/service.js";

export const LOGISTICS_ROLES: ReadonlySet<string> = new Set(["developer", "chief", "co-chief", "logistikk"]);

export async function requireAuthenticated(request: FastifyRequest, auth: AuthService): Promise<CurrentUser> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new AuthenticationError("Gyldig innlogging kreves.");
  return auth.authenticate(header.slice("Bearer ".length));
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

export function authenticationErrorCode(error: AuthenticationError): "UNAUTHORIZED" | "FORBIDDEN" | "OIDC_NOT_CONFIGURED" {
  if (error.statusCode === 403) return "FORBIDDEN";
  if (error.statusCode === 503) return "OIDC_NOT_CONFIGURED";
  return "UNAUTHORIZED";
}
