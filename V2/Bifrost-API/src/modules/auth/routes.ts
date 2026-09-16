import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticationErrorCode, requireAuthenticated } from "../../http/authorization.js";
import { AuthenticationError, type AuthService } from "./service.js";

export async function registerAuthRoutes(app: FastifyInstance, auth: AuthService): Promise<void> {
  app.get("/api/v1/auth/config", async (request, reply) => {
    try {
      return await auth.getPublicConfig();
    } catch (error) {
      return sendAuthError(error, request, reply);
    }
  });

  app.get("/api/v1/me", async (request, reply) => {
    try {
      return await requireAuthenticated(request, auth);
    } catch (error) {
      return sendAuthError(error, request, reply);
    }
  });
}

function sendAuthError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  const authError = error instanceof AuthenticationError
    ? error
    : new AuthenticationError("Token kunne ikke valideres.");
  const body: ApiError = {
    error: {
      code: authenticationErrorCode(authError),
      message: authError.message,
      requestId: request.id,
    },
  };
  return reply.code(authError.statusCode).send(body);
}
