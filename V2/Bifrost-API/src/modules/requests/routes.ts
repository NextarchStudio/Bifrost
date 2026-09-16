import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, LOGISTICS_ROLES, requireAuthenticated, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import { EquipmentRequestDomainError, type EquipmentRequestService } from "./service.js";

const idSchema = z.coerce.number().int().min(1);
const createSchema = z.object({
  items: z.array(z.object({
    equipmentId: z.coerce.number().int().min(1),
    quantity: z.coerce.number().int().min(1).max(100),
    note: z.string().trim().max(255).optional(),
  })).min(1).max(100),
});
const statusSchema = z.object({ status: z.enum(["pending", "rejected", "fulfilled"]) });
const approvalSchema = z.object({
  approveAll: z.boolean().default(false),
  decisions: z.array(z.object({
    itemId: z.coerce.number().int().min(1),
    approvedQuantity: z.coerce.number().int().min(0).max(100),
    rejected: z.boolean().default(false),
    privateEquipmentConfirmed: z.boolean().optional(),
  })).max(100).default([]),
});

export async function registerEquipmentRequestRoutes(app: FastifyInstance, auth: AuthService, service: EquipmentRequestService): Promise<void> {
  app.get("/api/v1/equipment-requests", async (request, reply) => {
    try { return await service.workspace(await requireAuthenticated(request, auth)); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/equipment-requests", async (request, reply) => {
    try {
      const user = await requireAuthenticated(request, auth);
      return reply.code(201).send(await service.create(createSchema.parse(request.body), user));
    } catch (error) { return sendError(error, request, reply); }
  });

  app.delete("/api/v1/equipment-requests/:id", async (request, reply) => {
    try {
      const user = await requireAuthenticated(request, auth);
      await service.delete(idSchema.parse((request.params as { id?: unknown }).id), user);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });

  app.patch("/api/v1/equipment-requests/:id/status", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til å behandle utstyrsforespørsler.");
      const id = idSchema.parse((request.params as { id?: unknown }).id);
      await service.updateStatus(id, statusSchema.parse(request.body).status, user);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/equipment-requests/:id/approve", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, LOGISTICS_ROLES, "Du har ikke tilgang til å behandle utstyrsforespørsler.");
      const id = idSchema.parse((request.params as { id?: unknown }).id);
      await service.approve(id, approvalSchema.parse(request.body), user);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message; }
  else if (error instanceof EquipmentRequestDomainError) { statusCode = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 409; code = error.code; message = error.message; }
  else if (error instanceof z.ZodError) { statusCode = 400; code = "INVALID_BODY"; message = "Ugyldige data for utstyrsforespørselen."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
