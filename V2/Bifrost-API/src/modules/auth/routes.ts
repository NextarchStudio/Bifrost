import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticationErrorCode, requireAuthenticated } from "../../http/authorization.js";
import type { AuthLoginService } from "./login-audit.js";
import type { LocalAuthService } from "./local-login.js";
import { AuthenticationError, type AuthService } from "./service.js";
import { z } from "zod";

const localLoginSchema = z.object({
  email: z.email().max(180),
  password: z.string().min(1).max(4096),
});

export async function registerAuthRoutes(app: FastifyInstance, auth: AuthService, login?: AuthLoginService, localAuth?: LocalAuthService): Promise<void> {
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

  if (login) {
    app.post("/api/v1/auth/session", async (request, reply) => {
      try {
        const header = request.headers.authorization;
        if (!header?.startsWith("Bearer ")) throw new AuthenticationError("Gyldig innlogging kreves.");
        return await login.complete(header.slice("Bearer ".length), request.ip);
      } catch (error) {
        return sendAuthError(error, request, reply);
      }
    });
  }

  if (localAuth) {
    app.post("/api/v1/auth/local", async (request, reply) => {
      try {
        return await localAuth.login(localLoginSchema.parse(request.body), request.ip);
      } catch (error) {
        return sendAuthError(error, request, reply);
      }
    });

    app.post("/api/v1/auth/logout", async (request, reply) => {
      try {
        const header = request.headers.authorization;
        if (!header?.startsWith("Bearer ")) throw new AuthenticationError("Gyldig innlogging kreves.");
        await localAuth.logout(header.slice("Bearer ".length));
        return reply.code(204).send();
      } catch (error) {
        return sendAuthError(error, request, reply);
      }
    });
  }
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
