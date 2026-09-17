import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, LOGISTICS_ROLES, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import { CrewDirectoryError, type CrewDirectoryService } from "./service.js";

const querySchema = z.object({ query: z.string().trim().min(1).max(120) });
const CREW_LOOKUP_ROLES: ReadonlySet<string> = new Set([...LOGISTICS_ROLES, "skiftleder", "sambandsansvarlig"]);

export async function registerCrewRoutes(app: FastifyInstance, auth: AuthService, crew: CrewDirectoryService): Promise<void> {
  app.get("/api/v1/crew/lookup", async (request, reply) => {
    try {
      await requireRoleAccess(request, auth, CREW_LOOKUP_ROLES, "Du har ikke tilgang til personoppslag.");
      const query = querySchema.parse(request.query);
      return await crew.lookup(query.query);
    } catch (error) { return sendError(error, request, reply); }
  });
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message; }
  else if (error instanceof CrewDirectoryError) { statusCode = error.code === "NOT_CONFIGURED" ? 503 : 404; code = error.code; message = error.message; }
  else if (error instanceof z.ZodError) { statusCode = 400; code = "INVALID_QUERY"; message = "Mangler Wannabe-ID eller badge-scan."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
