import type { ApiError, HealthResponse, ReadyResponse } from "@bifrost/contracts";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import type { AuthLoginService } from "./modules/auth/login-audit.js";
import type { AuthService } from "./modules/auth/service.js";
import type { LocalAuthService } from "./modules/auth/local-login.js";
import { registerBarcodeRoutes } from "./modules/barcodes/routes.js";
import type { BarcodeService } from "./modules/barcodes/service.js";
import { registerEquipmentRoutes } from "./modules/equipment/routes.js";
import type { EquipmentService } from "./modules/equipment/service.js";
import { registerCategoryRoutes } from "./modules/categories/routes.js";
import type { CategoryService } from "./modules/categories/service.js";
import { registerLocationRoutes } from "./modules/locations/routes.js";
import type { LocationService } from "./modules/locations/service.js";
import { registerWarehouseRoutes } from "./modules/warehouse/routes.js";
import type { WarehouseService } from "./modules/warehouse/service.js";
import { registerLoanRoutes } from "./modules/loans/routes.js";
import type { LoanService } from "./modules/loans/service.js";
import { registerCrewRoutes } from "./modules/crew/routes.js";
import type { CrewDirectoryService } from "./modules/crew/service.js";
import { registerPrivateEquipmentRoutes } from "./modules/private-equipment/routes.js";
import type { PrivateEquipmentService } from "./modules/private-equipment/service.js";
import { registerEquipmentRequestRoutes } from "./modules/requests/routes.js";
import type { EquipmentRequestService } from "./modules/requests/service.js";
import { registerVehicleRoutes } from "./modules/vehicles/routes.js";
import type { VehicleService } from "./modules/vehicles/service.js";
import { registerProfileRoutes } from "./modules/profiles/routes.js";
import type { ProfileService } from "./modules/profiles/service.js";
import { registerTransportRoutes } from "./modules/transport/routes.js";
import type { TransportService } from "./modules/transport/service.js";
import { registerCommsRoutes } from "./modules/comms/routes.js";
import type { CommsService } from "./modules/comms/service.js";
import { registerShopRoutes } from "./modules/shop/routes.js";
import type { ShopService } from "./modules/shop/service.js";
import type { CrewClothingService } from "./modules/crew-clothing/service.js";
import { registerTaskRoutes } from "./modules/tasks/routes.js";
import type { TaskService } from "./modules/tasks/service.js";
import { registerFeedbackRoutes } from "./modules/feedback/routes.js";
import type { FeedbackService } from "./modules/feedback/service.js";
import { registerAdminRoutes } from "./modules/admin/routes.js";
import type { AdminService } from "./modules/admin/service.js";
import { registerDashboardRoutes } from "./modules/dashboard/routes.js";
import type { DashboardService } from "./modules/dashboard/service.js";
import { BOOTSTRAP_WEB_ORIGINS } from "./modules/settings/web-origins.js";

export interface AppDependencies {
  checkDatabase: () => Promise<void>;
  allowedWebOrigins?: readonly string[];
  version?: string;
  auth?: AuthService;
  login?: AuthLoginService;
  localAuth?: LocalAuthService;
  barcodes?: BarcodeService;
  equipment?: EquipmentService;
  categories?: CategoryService;
  locations?: LocationService;
  warehouse?: WarehouseService;
  loans?: LoanService;
  crew?: CrewDirectoryService;
  privateEquipment?: PrivateEquipmentService;
  requests?: EquipmentRequestService;
  vehicles?: VehicleService;
  profiles?: ProfileService;
  transport?: TransportService;
  comms?: CommsService;
  shop?: ShopService;
  crewClothing?: CrewClothingService;
  tasks?: TaskService;
  feedback?: FeedbackService;
  admin?: AdminService;
  dashboard?: DashboardService;
}

export function buildApp(dependencies: AppDependencies): FastifyInstance {
  const app = Fastify({
    logger: true,
    genReqId: (request) => request.headers["x-request-id"]?.toString() ?? crypto.randomUUID(),
  });

  void app.register(helmet);
  void app.register(multipart, { limits: { files: 1, fileSize: 10 * 1024 * 1024 } });
  const allowedWebOrigins = dependencies.allowedWebOrigins ?? BOOTSTRAP_WEB_ORIGINS;
  void app.register(cors, {
    origin: [...allowedWebOrigins],
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Bifrost-Client", "X-Request-Id"],
    exposedHeaders: ["Content-Disposition", "X-Barcode-Count"],
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

  if (dependencies.auth) void registerAuthRoutes(app, dependencies.auth, dependencies.login, dependencies.localAuth);
  if (dependencies.auth && dependencies.barcodes) void registerBarcodeRoutes(app, dependencies.auth, dependencies.barcodes);
  if (dependencies.auth && dependencies.equipment) void registerEquipmentRoutes(app, dependencies.auth, dependencies.equipment);
  if (dependencies.auth && dependencies.categories) void registerCategoryRoutes(app, dependencies.auth, dependencies.categories);
  if (dependencies.auth && dependencies.locations) void registerLocationRoutes(app, dependencies.auth, dependencies.locations);
  if (dependencies.auth && dependencies.warehouse) void registerWarehouseRoutes(app, dependencies.auth, dependencies.warehouse);
  if (dependencies.auth && dependencies.loans) void registerLoanRoutes(app, dependencies.auth, dependencies.loans);
  if (dependencies.auth && dependencies.crew) void registerCrewRoutes(app, dependencies.auth, dependencies.crew);
  if (dependencies.auth && dependencies.privateEquipment) void registerPrivateEquipmentRoutes(app, dependencies.auth, dependencies.privateEquipment);
  if (dependencies.auth && dependencies.requests) void registerEquipmentRequestRoutes(app, dependencies.auth, dependencies.requests);
  if (dependencies.auth && dependencies.vehicles) void registerVehicleRoutes(app, dependencies.auth, dependencies.vehicles);
  if (dependencies.auth && dependencies.profiles) void registerProfileRoutes(app, dependencies.auth, dependencies.profiles, dependencies.crew);
  if (dependencies.auth && dependencies.transport) void registerTransportRoutes(app, dependencies.auth, dependencies.transport);
  if (dependencies.auth && dependencies.comms) void registerCommsRoutes(app, dependencies.auth, dependencies.comms);
  if (dependencies.auth && dependencies.shop && dependencies.crewClothing) {
    void registerShopRoutes(app, dependencies.auth, dependencies.shop, dependencies.crewClothing);
  }
  if (dependencies.auth && dependencies.tasks) void registerTaskRoutes(app, dependencies.auth, dependencies.tasks);
  if (dependencies.auth && dependencies.feedback) void registerFeedbackRoutes(app, dependencies.auth, dependencies.feedback);
  if (dependencies.auth && dependencies.admin) void registerAdminRoutes(app, dependencies.auth, dependencies.admin);
  if (dependencies.auth && dependencies.dashboard) void registerDashboardRoutes(app, dependencies.auth, dependencies.dashboard);

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
