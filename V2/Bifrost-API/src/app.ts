import type { ApiError, HealthResponse, ReadyResponse } from "@bifrost/contracts";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import type { AuthService } from "./modules/auth/service.js";
import { registerEquipmentRoutes } from "./modules/equipment/routes.js";
import type { EquipmentService } from "./modules/equipment/service.js";

export interface AppDependencies {
  checkDatabase: () => Promise<void>;
  version?: string;
  auth?: AuthService;
  equipment?: EquipmentService;
}

export function buildApp(dependencies: AppDependencies): FastifyInstance {
  const app = Fastify({
    logger: true,
    genReqId: (request) => request.headers["x-request-id"]?.toString() ?? crypto.randomUUID(),
  });

  void app.register(helmet);
  void app.register(cors, {
    origin: [/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/],
    allowedHeaders: ["Authorization", "Content-Type", "X-Bifrost-Client", "X-Request-Id"],
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

  if (dependencies.auth) void registerAuthRoutes(app, dependencies.auth);
  if (dependencies.auth && dependencies.equipment) void registerEquipmentRoutes(app, dependencies.auth, dependencies.equipment);

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
