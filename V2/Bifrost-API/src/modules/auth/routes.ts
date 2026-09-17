import type { ApiError } from "@bifrost/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticationErrorCode, authenticationTokenFromRequest, requireAuthenticated } from "../../http/authorization.js";
import {
  readOidcFlowCookie,
  serializeClearedOidcFlowCookie,
  serializeOidcFlowCookie,
  type ConfidentialOidcService,
} from "./confidential-oidc.js";
import type { AuthLoginService } from "./login-audit.js";
import type { LocalAuthService } from "./local-login.js";
import { serializeClearedSessionCookie, serializeSessionCookie } from "./local-session.js";
import { AuthenticationError, type AuthService } from "./service.js";
import { z } from "zod";

const localLoginSchema = z.object({
  email: z.email().max(180),
  password: z.string().min(1).max(4096),
});

const oidcStartSchema = z.object({ origin: z.url().max(255) });
const oidcCallbackSchema = z.object({
  code: z.string().min(1).max(4096),
  state: z.string().min(32).max(512),
});

export async function registerAuthRoutes(
  app: FastifyInstance,
  auth: AuthService,
  login?: AuthLoginService,
  localAuth?: LocalAuthService,
  oidc?: ConfidentialOidcService,
): Promise<void> {
  app.get("/api/v1/auth/config", async (request, reply) => {
    try {
      const query = request.query as { origin?: unknown };
      const requestedOrigin = typeof query.origin === "string" && query.origin.length <= 255 ? query.origin : undefined;
      return await auth.getPublicConfig(requestedOrigin);
    } catch (error) {
      return sendAuthError(error, request, reply);
    }
  });

  if (oidc) {
    app.post("/api/v1/auth/oidc/start", async (request, reply) => {
      try {
        const result = await oidc.start(oidcStartSchema.parse(request.body));
        reply.header("Set-Cookie", serializeOidcFlowCookie(result.browserBinding, result.secureCookie));
        return { authorizationUrl: result.authorizationUrl };
      } catch (error) {
        return sendAuthError(error, request, reply);
      }
    });

    app.post("/api/v1/auth/oidc/callback", async (request, reply) => {
      try {
        const result = await oidc.complete(
          oidcCallbackSchema.parse(request.body),
          request.ip,
          readOidcFlowCookie(request.headers.cookie),
        );
        reply.header("Set-Cookie", [
          serializeClearedOidcFlowCookie(result.secureCookie),
          serializeSessionCookie(result.accessToken, new Date(result.expiresAt), result.secureCookie),
        ]);
        return { expiresAt: result.expiresAt, user: result.user };
      } catch (error) {
        reply.header("Set-Cookie", serializeClearedOidcFlowCookie(isSecureRequest(request)));
        return sendAuthError(error, request, reply);
      }
    });
  }

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
        await localAuth.logout(authenticationTokenFromRequest(request));
        reply.header("Set-Cookie", serializeClearedSessionCookie(isSecureRequest(request)));
        return reply.code(204).send();
      } catch (error) {
        return sendAuthError(error, request, reply);
      }
    });
  }
}

function isSecureRequest(request: FastifyRequest): boolean {
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol;
  if (protocol?.split(",")[0]?.trim().toLowerCase() === "https") return true;
  return request.headers.origin?.startsWith("https://") ?? false;
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
