import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticationErrorCode, requireAuthenticated } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "../auth/service.js";
import type { CrewDirectoryService } from "../crew/service.js";
import { ProfileDomainError, type ProfileService } from "./service.js";

const paramsSchema = z.object({ wannabeId: z.coerce.number().int().positive() });

export async function registerProfileRoutes(
  app: FastifyInstance,
  auth: AuthService,
  profiles: ProfileService,
  crew?: CrewDirectoryService,
): Promise<void> {
  app.get("/api/v1/profiles/:wannabeId", async (request, reply) => {
    try {
      const viewer = await requireAuthenticated(request, auth);
      const { wannabeId } = paramsSchema.parse(request.params);
      return await profiles.profile(viewer, wannabeId);
    } catch (error) { return sendError(error, request, reply); }
  });

  app.get("/api/v1/profiles/:wannabeId/picture", async (request, reply) => {
    try {
      await requireAuthenticated(request, auth);
      const { wannabeId } = paramsSchema.parse(request.params);
      if (!crew || !await profiles.canShowPicture(wannabeId)) return reply.code(404).send();
      const picture = await crew.picture(wannabeId);
      if (!picture) return reply.code(404).send();
      return reply.header("Cache-Control", "private, max-age=900").type(picture.contentType).send(picture.body);
    } catch (error) { return sendError(error, request, reply); }
  });
}

function sendError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500; let code = "INTERNAL_ERROR"; let message = "En intern feil oppstod.";
  if (error instanceof AuthenticationError) {
    statusCode = error.statusCode; code = authenticationErrorCode(error); message = error.message;
  } else if (error instanceof ProfileDomainError) {
    statusCode = error.code === "NOT_FOUND" ? 404 : 403; code = error.code; message = error.message;
  } else if (error instanceof z.ZodError) {
    statusCode = 400; code = "INVALID_PARAMS"; message = "Ugyldig Wannabe-ID.";
  }
  const body: ApiError = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}
