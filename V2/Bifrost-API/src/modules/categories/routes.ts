import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import { CategoryDomainError, type CategoryService } from "./service.js";

const roles = new Set(["developer", "chief", "co-chief", "logistikk"]);
const nameSchema = z.object({ name: z.string().trim().min(1).max(80) });
const idSchema = z.coerce.number().int().min(1);

export async function registerCategoryRoutes(app: FastifyInstance, auth: AuthService, categories: CategoryService): Promise<void> {
  app.get("/api/v1/equipment-categories", async (request, reply) => {
    try { await requireAccess(request, auth); return categories.list(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/equipment-categories", async (request, reply) => {
    try {
      const user = await requireAccess(request, auth);
      const body = nameSchema.parse(request.body);
      return reply.code(201).send(await categories.create(body.name, user.id));
    } catch (error) { return sendError(error, request, reply); }
  });

  app.delete("/api/v1/equipment-categories/:id", async (request, reply) => {
    try {
      const user = await requireAccess(request, auth);
      const id = idSchema.parse((request.params as { id?: unknown }).id);
      await categories.delete(id, user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });
}

async function requireAccess(request: FastifyRequest, auth: AuthService) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new AuthenticationError("Gyldig innlogging kreves.");
  const user = await auth.authenticate(header.slice(7));
  if (!user.roles.some((role) => roles.has(role))) throw new AuthenticationError("Du har ikke tilgang til kategorier.", 403);
  return user;
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = error.statusCode === 403 ? "FORBIDDEN" : "UNAUTHORIZED"; message = error.message; }
  else if (error instanceof CategoryDomainError) { statusCode = error.code === "NOT_FOUND" ? 404 : 409; code = error.code; message = error.message; }
  else if (error instanceof z.ZodError) { statusCode = 400; code = "INVALID_BODY"; message = "Ugyldige kategoridata."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
