import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import { LocationDomainError, type LocationService } from "./service.js";

const roles = new Set(["developer", "chief", "co-chief", "logistikk"]);
const locationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(50),
  address: z.string().trim().max(255).optional(),
});
const idSchema = z.coerce.number().int().min(1);

export async function registerLocationRoutes(app: FastifyInstance, auth: AuthService, locations: LocationService): Promise<void> {
  app.get("/api/v1/locations", async (request, reply) => {
    try { await requireAccess(request, auth); return locations.list(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/locations", async (request, reply) => {
    try {
      const user = await requireAccess(request, auth);
      const body = locationSchema.parse(request.body);
      return reply.code(201).send(await locations.create(body, user.id));
    } catch (error) { return sendError(error, request, reply); }
  });

  app.patch("/api/v1/locations/:id", async (request, reply) => {
    try {
      const user = await requireAccess(request, auth);
      const id = idSchema.parse((request.params as { id?: unknown }).id);
      await locations.update(id, locationSchema.parse(request.body), user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });

  app.delete("/api/v1/locations/:id", async (request, reply) => {
    try {
      const user = await requireAccess(request, auth);
      const id = idSchema.parse((request.params as { id?: unknown }).id);
      await locations.delete(id, user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });
}

async function requireAccess(request: FastifyRequest, auth: AuthService) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new AuthenticationError("Gyldig innlogging kreves.");
  const user = await auth.authenticate(header.slice(7));
  if (!user.roles.some((role) => roles.has(role))) throw new AuthenticationError("Du har ikke tilgang til lokasjoner.", 403);
  return user;
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = error.statusCode === 403 ? "FORBIDDEN" : "UNAUTHORIZED"; message = error.message; }
  else if (error instanceof LocationDomainError) { statusCode = error.code === "NOT_FOUND" ? 404 : 409; code = error.code; message = error.message; }
  else if (error instanceof z.ZodError) { statusCode = 400; code = "INVALID_BODY"; message = "Ugyldige lokasjonsdata."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
