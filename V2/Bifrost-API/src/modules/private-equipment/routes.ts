import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, LOGISTICS_ROLES, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import { PrivateEquipmentDomainError, type PrivateEquipmentService } from "./service.js";

const createSchema = z.object({
  ownerName: z.string().trim().min(1).max(180),
  barcodePrefix: z.string().trim().min(1).max(120),
});
const idSchema = z.coerce.number().int().min(1);

export async function registerPrivateEquipmentRoutes(app: FastifyInstance, auth: AuthService, service: PrivateEquipmentService): Promise<void> {
  app.get("/api/v1/private-equipment", async (request, reply) => {
    try { await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til privat utstyr."); return await service.list(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.get("/api/v1/private-equipment/notices", async (request, reply) => {
    try { await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til privat utstyr."); return await service.listNotices(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/private-equipment", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til privat utstyr.");
      return reply.code(201).send(await service.create(createSchema.parse(request.body), user.id));
    } catch (error) { return sendError(error, request, reply); }
  });

  app.delete("/api/v1/private-equipment/:id", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til privat utstyr.");
      const id = idSchema.parse((request.params as { id?: unknown }).id);
      await service.delete(id, user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message; }
  else if (error instanceof PrivateEquipmentDomainError) { statusCode = error.code === "NOT_FOUND" ? 404 : error.code === "INVALID" ? 400 : 409; code = error.code; message = error.message; }
  else if (error instanceof z.ZodError) { statusCode = 400; code = "INVALID_BODY"; message = "Ugyldige data for privat utstyr."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
