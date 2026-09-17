import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import { COMMS_ROLES, CommsDomainError, type CommsService } from "./service.js";

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const itemSchema = z.object({
  name: z.string().trim().min(2).max(140),
  type: z.enum(["samband", "tilbehor"]),
  serialNumber: z.string().trim().max(150).nullable().optional(),
  quantity: z.number().int().min(1).max(1000),
  notes: z.string().trim().max(2000).nullable().optional(),
});
const setSchema = z.object({
  name: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(2000).nullable().optional(),
  items: z.array(z.object({ itemId: z.number().int().positive(), quantity: z.number().int().min(1).max(1000) })).min(1).max(500),
});
const issueSchema = z.discriminatedUnion("loanType", [
  z.object({ wannabeId: z.number().int().positive(), loanType: z.literal("item"), itemId: z.number().int().positive(), quantity: z.number().int().min(1).max(100), notes: z.string().trim().max(2000).nullable().optional() }),
  z.object({ wannabeId: z.number().int().positive(), loanType: z.literal("set"), setId: z.number().int().positive(), notes: z.string().trim().max(2000).nullable().optional() }),
]);
const returnSchema = z.object({
  returns: z.array(z.object({ itemId: z.number().int().positive(), quantity: z.number().int().min(0).max(1000) })).max(500).default([]),
  replacementItemId: z.number().int().positive().nullable().optional(),
  replacementQuantity: z.number().int().min(0).max(1000).nullable().optional(),
}).superRefine((value, context) => {
  const ids = value.returns.map((line) => line.itemId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: ["returns"], message: "Hver lånelinje kan bare returneres én gang." });
  if ((value.replacementQuantity ?? 0) > 0 && !value.replacementItemId) context.addIssue({ code: "custom", path: ["replacementItemId"], message: "Velg erstatningsutstyr." });
});

export async function registerCommsRoutes(app: FastifyInstance, auth: AuthService, service: CommsService): Promise<void> {
  app.get("/api/v1/comms", async (request, reply) => {
    try { await authorize(request, auth); return await service.workspace(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/comms/items", async (request, reply) => {
    try { const user = await authorize(request, auth); return reply.code(201).send(await service.createItem(itemSchema.parse(request.body), user.id)); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/comms/sets", async (request, reply) => {
    try { const user = await authorize(request, auth); return reply.code(201).send(await service.createSet(setSchema.parse(request.body), user.id)); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.patch("/api/v1/comms/sets/:id", async (request, reply) => {
    try { const user = await authorize(request, auth); const { id } = idParamsSchema.parse(request.params); await service.updateSet(id, setSchema.parse(request.body), user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.delete("/api/v1/comms/sets/:id", async (request, reply) => {
    try { const user = await authorize(request, auth); const { id } = idParamsSchema.parse(request.params); await service.deleteSet(id, user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/comms/loans", async (request, reply) => {
    try { const user = await authorize(request, auth); return reply.code(201).send(await service.issue(issueSchema.parse(request.body), user.id)); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/comms/loans/:id/return", async (request, reply) => {
    try { const user = await authorize(request, auth); const { id } = idParamsSchema.parse(request.params); await service.returnLoan(id, returnSchema.parse(request.body), user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });
}

function authorize(request: FastifyRequest, auth: AuthService) {
  return requireRoleAccess(request, auth, COMMS_ROLES, "Du har ikke tilgang til samband.");
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message; }
  else if (error instanceof CommsDomainError) { statusCode = error.code === "NOT_FOUND" ? 404 : 409; code = error.code; message = error.message; }
  else if (error instanceof z.ZodError) { statusCode = 400; code = "INVALID_BODY"; message = error.issues[0]?.message ?? "Ugyldige sambandsdata."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
