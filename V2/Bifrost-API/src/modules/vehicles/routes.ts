import type { ApiError } from "@bifrost/contracts";
import { VEHICLE_COMPETENCY_CODES } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import {
  VEHICLE_COMPETENCY_ADMIN_ROLES,
  VEHICLE_EDIT_ROLES,
  VEHICLE_ROLES,
  VehicleDomainError,
  type VehicleService,
} from "./service.js";

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const competencyParamsSchema = z.object({ wannabeId: z.coerce.number().int().positive() });
const competencyQuerySchema = z.object({ vehicleId: z.coerce.number().int().positive().optional() });
const competencyCodeSchema = z.enum(VEHICLE_COMPETENCY_CODES);
const requirementSchema = z.enum(["none", "kdo", ...VEHICLE_COMPETENCY_CODES]);
const createSchema = z.object({
  name: z.string().trim().min(2).max(150),
  registrationNumber: z.string().trim().min(2).max(20),
  competencyRequirement: requirementSchema,
  competencyOverrideRequirement: competencyCodeSchema.nullable().optional(),
  odometerMode: z.enum(["tracked", "exempt"]),
  currentOdometer: z.number().int().nonnegative().nullable().optional(),
  vegvesenExempt: z.boolean().default(false),
  notes: z.string().trim().max(4000).nullable().optional(),
}).superRefine((value, context) => {
  if (value.odometerMode === "tracked" && value.currentOdometer === undefined) {
    context.addIssue({ code: "custom", path: ["currentOdometer"], message: "Kilometerstand er påkrevd." });
  }
});
const updateSchema = z.object({
  name: z.string().trim().min(2).max(150),
  registrationNumber: z.string().trim().min(2).max(20),
  competencyRequirement: requirementSchema,
  competencyOverrideRequirement: competencyCodeSchema.nullable().optional(),
  vegvesenExempt: z.boolean().default(false),
});
const issueSchema = z.object({
  vehicleId: z.number().int().positive(),
  wannabeId: z.number().int().positive(),
  competencyConfirmed: z.boolean().default(false),
  competencies: z.array(z.enum(["kdo", ...VEHICLE_COMPETENCY_CODES])).default([]),
});
const saveCompetenciesSchema = z.object({ competencies: z.array(competencyCodeSchema) });

export async function registerVehicleRoutes(app: FastifyInstance, auth: AuthService, service: VehicleService): Promise<void> {
  app.get("/api/v1/vehicles", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, VEHICLE_ROLES, "Du har ikke tilgang til kjøretøy.");
      return await service.workspace(user);
    } catch (error) { return sendError(error, request, reply); }
  });

  app.get("/api/v1/vehicles/competencies/:wannabeId", async (request, reply) => {
    try {
      await requireRoleAccess(request, auth, VEHICLE_ROLES, "Du har ikke tilgang til kompetanseprofilen.");
      const { wannabeId } = competencyParamsSchema.parse(request.params);
      const { vehicleId } = competencyQuerySchema.parse(request.query);
      return await service.competencyProfile(wannabeId, vehicleId);
    } catch (error) { return sendError(error, request, reply); }
  });

  app.put("/api/v1/vehicles/competencies/:wannabeId", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, VEHICLE_COMPETENCY_ADMIN_ROLES, "Du har ikke tilgang til å endre kompetanseprofiler.");
      const { wannabeId } = competencyParamsSchema.parse(request.params);
      const body = saveCompetenciesSchema.parse(request.body);
      await service.saveCompetencyProfile(wannabeId, body.competencies, user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/vehicles", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, VEHICLE_ROLES, "Du har ikke tilgang til å opprette kjøretøy.");
      return reply.code(201).send(await service.create(createSchema.parse(request.body), user.id));
    } catch (error) { return sendError(error, request, reply); }
  });

  app.patch("/api/v1/vehicles/:id", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, VEHICLE_EDIT_ROLES, "Du har ikke tilgang til å endre kjøretøy.");
      const { id } = idParamsSchema.parse(request.params);
      await service.update(id, updateSchema.parse(request.body), user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });

  app.delete("/api/v1/vehicles/:id", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, VEHICLE_EDIT_ROLES, "Du har ikke tilgang til å slette kjøretøy.");
      const { id } = idParamsSchema.parse(request.params);
      await service.delete(id, user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/vehicle-loans", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, VEHICLE_ROLES, "Du har ikke tilgang til kjøretøylån.");
      return reply.code(201).send(await service.issue(issueSchema.parse(request.body), user.id));
    } catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/vehicle-loans/:id/return", async (request, reply) => {
    try {
      const user = await requireRoleAccess(request, auth, VEHICLE_ROLES, "Du har ikke tilgang til kjøretøylån.");
      const { id } = idParamsSchema.parse(request.params);
      await service.returnLoan(id, user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) {
    statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message;
  } else if (error instanceof VehicleDomainError) {
    statusCode = error.code === "NOT_FOUND" ? 404 : 409; code = error.code; message = error.message;
  } else if (error instanceof z.ZodError) {
    statusCode = 400; code = "INVALID_BODY"; message = error.issues[0]?.message ?? "Ugyldige kjøretøydata.";
  }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
