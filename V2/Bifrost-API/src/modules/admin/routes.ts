import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import { ADMIN_ROLES, AdminDomainError, SYSTEM_SETTINGS_ROLES, type AdminService } from "./service.js";
import { CREW_RESET_CONFIRMATION, CrewResetDomainError } from "./crew-reset.js";

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const createUserSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().max(180),
  wannabeId: z.number().int().positive().nullable().optional(),
});
const roleSchema = z.object({ name: z.string().trim().min(1).max(100), displayName: z.string().trim().max(100).nullable().optional(), wannabeRoleName: z.string().trim().max(100).nullable().optional() });
const activeSchema = z.object({ active: z.boolean() });
const rolesSchema = z.object({ roleIds: z.array(z.number().int().positive()).max(100) });
const competencySchema = z.object({ competencies: z.array(z.enum(["t1", "t2", "t3", "t4", "b", "be", "c1", "c1e", "c", "ce"])).max(10) });
const settingsSchema = z.object({
  appName: z.string().trim().min(1).max(120),
  localLoginEnabled: z.boolean(),
  webOrigins: z.array(z.string().trim().url().max(255)).min(1).max(10),
  logoUrl: z.string().trim().url().max(255).nullable().optional(),
  faviconUrl: z.string().trim().url().max(255).nullable().optional(),
  keycloakBaseUrl: z.string().trim().url().max(255).nullable().optional(),
  keycloakRealm: z.string().trim().max(120).nullable().optional(),
  keycloakClientId: z.string().trim().max(180).nullable().optional(),
  keycloakClientSecret: z.string().max(4096).nullable().optional(),
  keycloakRedirectUri: z.string().trim().url().max(255).nullable().optional(),
  smtpFromEmail: z.email().max(180).nullable().optional(),
  smtpFromName: z.string().trim().max(180).nullable().optional(),
  smtpHost: z.string().trim().max(180).nullable().optional(),
  smtpPort: z.number().int().min(1).max(65535).nullable().optional(),
  smtpUser: z.string().trim().max(180).nullable().optional(),
  smtpPassword: z.string().max(4096).nullable().optional(),
  smtpCrypto: z.enum(["tls", "ssl"]).nullable().optional(),
  osrmBaseUrl: z.string().trim().url().max(255).nullable().optional(),
  vegvesenApiKey: z.string().max(4096).nullable().optional(),
  crewApiBaseUrl: z.string().trim().url().max(255).nullable().optional(),
  crewApiProfileEndpoint: z.string().trim().max(255).nullable().optional(),
  crewApiPictureEndpoint: z.string().trim().max(255).nullable().optional(),
  crewApiBearerToken: z.string().max(4096).nullable().optional(),
});
const crewResetSchema = z.object({ confirmation: z.literal(CREW_RESET_CONFIRMATION) });

export async function registerAdminRoutes(app: FastifyInstance, auth: AuthService, admin: AdminService): Promise<void> {
  app.get("/api/v1/admin", async (request, reply) => {
    try { const user = await authorizeAdmin(request, auth); return await admin.workspace(user.roles.some((role) => SYSTEM_SETTINGS_ROLES.has(role))); }
    catch (error) { return sendError(error, request, reply); }
  });
  app.get("/api/v1/admin/statistics", async (request, reply) => {
    try { await authorizeAdmin(request, auth); return await admin.statistics(); }
    catch (error) { return sendError(error, request, reply); }
  });
  app.post("/api/v1/admin/users", async (request, reply) => {
    try { const user = await authorizeAdmin(request, auth); return reply.code(201).send(await admin.createUser(createUserSchema.parse(request.body), user.id)); }
    catch (error) { return sendError(error, request, reply); }
  });
  app.patch("/api/v1/admin/users/:id/active", async (request, reply) => {
    try { const user = await authorizeAdmin(request, auth); const { id } = idSchema.parse(request.params); await admin.setUserActive(id, activeSchema.parse(request.body).active, user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });
  app.put("/api/v1/admin/users/:id/roles", async (request, reply) => {
    try { const user = await authorizeAdmin(request, auth); const { id } = idSchema.parse(request.params); await admin.syncUserRoles(id, rolesSchema.parse(request.body).roleIds, user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });
  app.put("/api/v1/admin/users/:id/competencies", async (request, reply) => {
    try { const user = await authorizeAdmin(request, auth); const { id } = idSchema.parse(request.params); await admin.updateUserCompetencies(id, competencySchema.parse(request.body).competencies, user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });
  app.delete("/api/v1/admin/users/:id", async (request, reply) => {
    try { const user = await authorizeAdmin(request, auth); const { id } = idSchema.parse(request.params); await admin.deleteUser(id, user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });
  app.post("/api/v1/admin/roles", async (request, reply) => {
    try { const user = await authorizeAdmin(request, auth); return reply.code(201).send(await admin.createRole(roleSchema.parse(request.body), user.id)); }
    catch (error) { return sendError(error, request, reply); }
  });
  app.patch("/api/v1/admin/roles/:id", async (request, reply) => {
    try { const user = await authorizeAdmin(request, auth); const { id } = idSchema.parse(request.params); await admin.updateRole(id, roleSchema.parse(request.body), user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });
  app.delete("/api/v1/admin/roles/:id", async (request, reply) => {
    try { const user = await authorizeAdmin(request, auth); const { id } = idSchema.parse(request.params); await admin.deleteRole(id, user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });
  app.put("/api/v1/admin/settings", async (request, reply) => {
    try { const user = await requireRoleAccess(request, auth, SYSTEM_SETTINGS_ROLES, "Bare developer kan administrere systeminnstillinger."); await admin.updateSettings(settingsSchema.parse(request.body), user.id); return reply.code(204).send(); }
    catch (error) { return sendError(error, request, reply); }
  });
  app.get("/api/v1/admin/crew-cache/preview", async (request, reply) => {
    try { await requireRoleAccess(request, auth, SYSTEM_SETTINGS_ROLES, "Bare developer kan forhåndsvise crew-reset."); return await admin.crewResetPreview(); }
    catch (error) { return sendError(error, request, reply); }
  });
  app.post("/api/v1/admin/crew-cache/clear", async (request, reply) => {
    try { const user = await requireRoleAccess(request, auth, SYSTEM_SETTINGS_ROLES, "Bare developer kan kjøre crew-reset."); const { confirmation } = crewResetSchema.parse(request.body); return await admin.clearCrewCache(confirmation, user.id); }
    catch (error) { return sendError(error, request, reply); }
  });
}

function authorizeAdmin(request: FastifyRequest, auth: AuthService) { return requireRoleAccess(request, auth, ADMIN_ROLES, "Du har ikke tilgang til administrasjon."); }
function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message; }
  else if (error instanceof AdminDomainError) { statusCode = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 409; code = error.code; message = error.message; }
  else if (error instanceof CrewResetDomainError) { statusCode = 409; code = "CONFLICT"; message = error.message; }
  else if (error instanceof z.ZodError) { statusCode = 400; code = "INVALID_BODY"; message = error.issues[0]?.message ?? "Ugyldige data."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
