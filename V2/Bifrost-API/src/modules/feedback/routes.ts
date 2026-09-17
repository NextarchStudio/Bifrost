import type { ApiError, CurrentUser, FeedbackStatus } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, requireAuthenticated, requireRoleAccess } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import {
  FeedbackDomainError,
  type FeedbackAttachmentUpload,
  type FeedbackService,
} from "./service.js";

const FEEDBACK_VIEW_ALL_ROLES: ReadonlySet<string> = new Set(["developer", "logistikk"]);
const FEEDBACK_MANAGER_ROLES: ReadonlySet<string> = new Set(["developer"]);
const BLOCKED_ROLE = "ingen_tilbakemeldinger";
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const createSchema = z.object({
  type: z.enum(["bug", "feature"]),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(10).max(5000),
  needsDatabaseFix: z.preprocess((value) => ["1", "true", "on", true].includes(value as string | boolean), z.boolean()),
});
const statusSchema = z.object({ status: z.enum(["pending", "on_hold", "approved", "in_progress", "fixed", "added", "rejected"]) });

export async function registerFeedbackRoutes(app: FastifyInstance, auth: AuthService, feedback: FeedbackService): Promise<void> {
  app.get("/api/v1/feedback", async (request, reply) => {
    try {
      const user = await authorizeFeedback(request, auth);
      return await feedback.workspace(user.id, hasAnyRole(user, FEEDBACK_VIEW_ALL_ROLES), hasAnyRole(user, FEEDBACK_MANAGER_ROLES));
    } catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/feedback", async (request, reply) => {
    try {
      const user = await authorizeFeedback(request, auth);
      const multipart = await parseCreateMultipart(request);
      const input = createSchema.parse(multipart.fields);
      return reply.code(201).send(await feedback.create(input, user, multipart.attachment));
    } catch (error) { return sendError(error, request, reply); }
  });

  app.patch("/api/v1/feedback/:id/status", async (request, reply) => {
    try {
      const user = await authorizeFeedbackManager(request, auth);
      const { id } = idParamsSchema.parse(request.params);
      const { status } = statusSchema.parse(request.body);
      await feedback.updateStatus(id, status as FeedbackStatus, user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });

  app.delete("/api/v1/feedback/:id", async (request, reply) => {
    try {
      const user = await authorizeFeedback(request, auth);
      const { id } = idParamsSchema.parse(request.params);
      await feedback.deleteOwn(id, user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });

  app.get("/api/v1/feedback/:id/attachment", async (request, reply) => {
    try {
      const user = await authorizeFeedback(request, auth);
      const { id } = idParamsSchema.parse(request.params);
      const attachment = await feedback.attachmentForUser(id, user.id, hasAnyRole(user, FEEDBACK_VIEW_ALL_ROLES));
      return reply
        .type(attachment.mime)
        .header("Content-Disposition", contentDisposition(attachment.name))
        .send(attachment.content);
    } catch (error) { return sendError(error, request, reply); }
  });

  app.get("/api/v1/feedback/notifications", async (request, reply) => {
    try {
      const user = await requireAuthenticated(request, auth);
      return await feedback.notificationPayload(user.id);
    } catch (error) { return sendError(error, request, reply); }
  });

  app.post("/api/v1/feedback/notifications/read", async (request, reply) => {
    try {
      const user = await requireAuthenticated(request, auth);
      await feedback.markNotificationsAsRead(user.id);
      return reply.code(204).send();
    } catch (error) { return sendError(error, request, reply); }
  });
}

async function parseCreateMultipart(request: FastifyRequest): Promise<{ fields: Record<string, unknown>; attachment?: FeedbackAttachmentUpload }> {
  if (!request.isMultipart()) throw new FeedbackDomainError("Tilbakemeldingen må sendes som et skjema.", "INVALID_FILE");
  const fields: Record<string, unknown> = { needsDatabaseFix: false };
  let attachment: FeedbackAttachmentUpload | undefined;
  for await (const part of request.parts({ limits: { files: 1, fields: 10, fileSize: MAX_ATTACHMENT_SIZE } })) {
    if (part.type === "file") {
      if (!part.filename) { part.file.resume(); continue; }
      const buffer = await part.toBuffer();
      if (part.file.truncated || buffer.length > MAX_ATTACHMENT_SIZE) throw new FeedbackDomainError("Bildet kan maks være 5 MB.", "FILE_TOO_LARGE");
      attachment = { filename: part.filename, mimetype: part.mimetype, buffer };
    } else {
      fields[fieldName(part.fieldname)] = part.value;
    }
  }
  return { fields, attachment };
}

function fieldName(value: string): string {
  return value === "needs_database_fix" ? "needsDatabaseFix" : value;
}

async function authorizeFeedback(request: FastifyRequest, auth: AuthService): Promise<CurrentUser> {
  const user = await requireAuthenticated(request, auth);
  if (user.roles.includes(BLOCKED_ROLE)) throw new AuthenticationError("Tilbakemeldinger er sperret for denne brukeren.", 403);
  return user;
}

async function authorizeFeedbackManager(request: FastifyRequest, auth: AuthService): Promise<CurrentUser> {
  const user = await requireRoleAccess(request, auth, FEEDBACK_MANAGER_ROLES, "Bare developer kan endre tilbakemeldingsstatus.");
  if (user.roles.includes(BLOCKED_ROLE)) throw new AuthenticationError("Tilbakemeldinger er sperret for denne brukeren.", 403);
  return user;
}

function hasAnyRole(user: CurrentUser, roles: ReadonlySet<string>): boolean { return user.roles.some((role) => roles.has(role)); }

function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^A-Za-z0-9._-]/g, "_") || "vedlegg";
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) { statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message; }
  else if (error instanceof FeedbackDomainError) {
    statusCode = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : error.code === "FILE_TOO_LARGE" ? 413 : error.code === "INVALID_FILE" ? 400 : 409;
    code = error.code; message = error.message;
  } else if (error instanceof z.ZodError) { statusCode = 400; code = "INVALID_BODY"; message = error.issues[0]?.message ?? "Ugyldige data."; }
  else if (error instanceof Error && "code" in error && error.code === "FST_REQ_FILE_TOO_LARGE") { statusCode = 413; code = "FILE_TOO_LARGE"; message = "Bildet kan maks være 5 MB."; }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
