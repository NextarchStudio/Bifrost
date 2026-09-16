import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, LOGISTICS_ROLES, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import { LocationDomainError, type LocationService } from "./service.js";

const locationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(50),
  address: z.string().trim().max(255).optional(),
});
const idSchema = z.coerce.number().int().min(1);

export async function registerLocationRoutes(app: FastifyInstance, auth: AuthService, locations: LocationService): Promise<void> {
  app.get("/api/v1/locations", async (request, reply) => {
    try { await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til lokasjoner."); return locations.list(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/locations", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til lokasjoner.");
      const body = locationSchema.parse(request.body);
      return reply.code(201).send(await locations.create(body, user.id));
    } catch (error) { return sendError(error, request, reply); }
  });

  app.patch("/api/v1/locations/:id", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til lokasjoner.");
      const id = idSchema.parse((request.params as { id?: unknown }).id);
      await locations.update(id, locationSchema.parse(request.body), user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });

  app.delete("/api/v1/locations/:id", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til lokasjoner.");
      const id = idSchema.parse((request.params as { id?: unknown }).id);
      await locations.delete(id, user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message; }
  else if (error instanceof LocationDomainError) { statusCode = error.code === "NOT_FOUND" ? 404 : 409; code = error.code; message = error.message; }
  else if (error instanceof z.ZodError) { statusCode = 400; code = "INVALID_BODY"; message = "Ugyldige lokasjonsdata."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
