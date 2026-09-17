import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import {
  TRANSPORT_ACCESS_ROLES,
  TRANSPORT_MANAGER_ROLES,
  TRANSPORT_REQUEST_ROLES,
  TransportDomainError,
  type TransportService,
} from "./service.js";

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const stopSchema = z.object({ address: z.string().trim().max(255), notes: z.string().trim().max(4000).nullable().optional() });
const createSchema = z.object({
  description: z.string().trim().min(1).max(5000),
  fromLocationId: z.number().int().positive(),
  toLocationId: z.number().int().positive(),
  vehicleId: z.number().int().positive(),
  jobKind: z.enum(["equipment", "innkjopsrunde", "henterunde"]),
  requesterUserId: z.number().int().positive().nullable().optional(),
  requesterWannabeId: z.number().int().positive().nullable().optional(),
  stops: z.array(stopSchema).max(100).default([]),
});
const peopleRequestSchema = z.object({
  description: z.string().trim().max(5000).nullable().optional(),
  fromLocationId: z.number().int().positive(),
  toLocationId: z.number().int().positive(),
  peopleCount: z.number().int().min(1).max(500),
  pickupAt: z.coerce.date(),
});
const assignSchema = z.object({ assignedUserId: z.number().int().positive() });
const startSchema = z.object({
  vehicleId: z.number().int().positive().nullable().optional(),
  startOdometer: z.number().int().nonnegative().nullable().optional(),
});
const completeSchema = z.object({ endOdometer: z.number().int().nonnegative().nullable().optional() });

export async function registerTransportRoutes(app: FastifyInstance, auth: AuthService, service: TransportService): Promise<void> {
  app.get("/api/v1/transport", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, TRANSPORT_ACCESS_ROLES, "Du har ikke tilgang til transport.");
      return await service.workspace(user);
    } catch (error) { return sendError(error, request, reply); }
  });

  app.get("/api/v1/transport/:id", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, TRANSPORT_ACCESS_ROLES, "Du har ikke tilgang til transport.");
      const { id } = idParamsSchema.parse(request.params);
      return await service.inspect(id, user);
    } catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/transport", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, TRANSPORT_MANAGER_ROLES, "Du har ikke tilgang til å opprette transportoppdrag.");
      return reply.code(201).send(await service.create(createSchema.parse(request.body), user.id));
    } catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/transport/people-requests", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, TRANSPORT_REQUEST_ROLES, "Denne rollen kan ikke opprette transportforespørsler.");
      return reply.code(201).send(await service.requestPeople(peopleRequestSchema.parse(request.body), user));
    } catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/transport/:id/assign", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, TRANSPORT_MANAGER_ROLES, "Du har ikke tilgang til å tildele transportoppdrag.");
      const { id } = idParamsSchema.parse(request.params);
      const { assignedUserId } = assignSchema.parse(request.body);
      await service.assign(id, assignedUserId, user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/transport/:id/start", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, TRANSPORT_MANAGER_ROLES, "Du har ikke tilgang til å starte transportoppdrag.");
      const { id } = idParamsSchema.parse(request.params);
      await service.start(id, startSchema.parse(request.body), user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/transport/:id/complete", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, TRANSPORT_MANAGER_ROLES, "Du har ikke tilgang til å fullføre transportoppdrag.");
      const { id } = idParamsSchema.parse(request.params);
      const { endOdometer } = completeSchema.parse(request.body);
      await service.complete(id, endOdometer ?? null, user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) {
    statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message;
  } else if (error instanceof TransportDomainError) {
    statusCode = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 409;
    code = error.code; message = error.message;
  } else if (error instanceof z.ZodError) {
    statusCode = 400; code = "INVALID_BODY"; message = error.issues[0]?.message ?? "Ugyldige transportdata.";
  }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
