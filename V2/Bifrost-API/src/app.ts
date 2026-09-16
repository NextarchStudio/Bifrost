import type { ApiError, HealthResponse, ReadyResponse } from "@bifrost/contracts";
import Fastify, { type FastifyInstance } from "fastify";

export interface AppDependencies {
  checkDatabase: () => Promise<void>;
  version?: string;
}

export function buildApp(dependencies: AppDependencies): FastifyInstance {
  const app = Fastify({
    logger: true,
    genReqId: (request) => request.headers["x-request-id"]?.toString() ?? crypto.randomUUID(),
  });

  app.get("/health", async (): Promise<HealthResponse> => ({
    service: "bifrost-api",
    status: "ok",
    version: dependencies.version ?? "0.1.0",
    timestamp: new Date().toISOString(),
  }));

  app.get("/ready", async (_request, reply): Promise<ReadyResponse> => {
    try {
      await dependencies.checkDatabase();
      return { service: "bifrost-api", status: "ready", database: "connected", timestamp: new Date().toISOString() };
    } catch {
      reply.code(503);
      return { service: "bifrost-api", status: "not_ready", database: "unavailable", timestamp: new Date().toISOString() };
    }
  });

  app.setNotFoundHandler((request, reply) => {
    const body: ApiError = { error: { code: "NOT_FOUND", message: "Ressursen finnes ikke.", requestId: request.id } };
    return reply.code(404).send(body);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "request failed");
    const body: ApiError = { error: { code: "INTERNAL_ERROR", message: "En intern feil oppstod.", requestId: request.id } };
    return reply.code(500).send(body);
  });

  return app;
}
