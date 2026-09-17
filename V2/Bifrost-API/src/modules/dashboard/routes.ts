import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, requireAuthenticated, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import type { DashboardService } from "./service.js";

export const DASHBOARD_SEARCH_ROLES: ReadonlySet<string> = new Set(["developer", "chief", "co-chief", "logistikk"]);
const searchSchema = z.object({ q: z.string().optional().default("") });

export async function registerDashboardRoutes(app: FastifyInstance, auth: AuthService, dashboard: DashboardService): Promise<void> {
  app.get("/api/v1/dashboard", async (request, reply) => {
    try { await requireAuthenticated(request, auth); return await dashboard.summary(); }
    catch (error) { return sendError(error, request, reply); }
  });
  app.get("/api/v1/search", async (request, reply) => {
    try {
      await requireRoleAccess(request, auth, DASHBOARD_SEARCH_ROLES, "Du har ikke tilgang til globalt søk.");
      return await dashboard.search(searchSchema.parse(request.query).q);
    } catch (error) { return sendError(error, request, reply); }
  });
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message; }
  else if (error instanceof z.ZodError) { statusCode = 400; code = "INVALID_QUERY"; message = error.issues[0]?.message ?? "Ugyldig søk."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
