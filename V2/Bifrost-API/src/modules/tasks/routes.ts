import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, requireAuthenticated, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import { TASK_MANAGER_ROLES, TaskDomainError, type TaskService } from "./service.js";

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const statusSchema = z.enum(["not_started", "in_progress", "blocked", "completed"]);
const createSchema = z.object({
  title: z.string().trim().min(3).max(180),
  type: z.enum(["work", "transport"]),
  transportJobId: z.number().int().positive().nullable().optional(),
  status: statusSchema,
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  message: z.string().trim().max(5000).nullable().optional(),
  description: z.string().trim().min(5).max(5000),
  assignedUserId: z.number().int().positive(),
  dueAt: z.coerce.date(),
});

export async function registerTaskRoutes(app: FastifyInstance, auth: AuthService, service: TaskService): Promise<void> {
  app.get("/api/v1/tasks", async (request, reply) => {
    try { const user = await requireAuthenticated(request, auth); return await service.workspace(user.id, user.roles.some((role) => TASK_MANAGER_ROLES.has(role))); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/tasks", async (request, reply) => {
    try { const user = await requireRoleAccess(request, auth, TASK_MANAGER_ROLES, "Du har ikke tilgang til å opprette oppgaver."); return reply.code(201).send(await service.create(createSchema.parse(request.body), user.id)); }
    catch (error) { return sendError(error, request, reply); }
  });

  app.patch("/api/v1/tasks/:id/status", async (request, reply) => {
    try {
      const user = await requireAuthenticated(request, auth);
      const { id } = idParamsSchema.parse(request.params);
      const { status } = z.object({ status: statusSchema }).parse(request.body);
      await service.updateStatus(id, status, user.id, user.roles.some((role) => TASK_MANAGER_ROLES.has(role)));
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message; }
  else if (error instanceof TaskDomainError) { statusCode = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 409; code = error.code; message = error.message; }
  else if (error instanceof z.ZodError) { statusCode = 400; code = "INVALID_BODY"; message = error.issues[0]?.message ?? "Ugyldige oppgavedata."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
