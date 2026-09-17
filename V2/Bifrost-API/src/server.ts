import { buildApp } from "./app.js";
import { createDatabase, readDatabaseConfig } from "@bifrost/database";
import { createAuthService } from "./modules/auth/service.js";
import { createAuthLoginService } from "./modules/auth/login-audit.js";
import { createEquipmentService } from "./modules/equipment/service.js";
import { createCategoryService } from "./modules/categories/service.js";
import { createLocationService } from "./modules/locations/service.js";
import { createWarehouseService } from "./modules/warehouse/service.js";
import { createLoanService } from "./modules/loans/service.js";
import { createCrewDirectoryService } from "./modules/crew/service.js";
import { createSecureSettingsStore } from "./modules/settings/secure-settings.js";
import { createPrivateEquipmentService } from "./modules/private-equipment/service.js";
import { createEquipmentRequestService } from "./modules/requests/service.js";
import { createVehicleService } from "./modules/vehicles/service.js";
import { createVegvesenVehicleDataService } from "./modules/vehicles/vegvesen.js";
import { createProfileService } from "./modules/profiles/service.js";
import { createTransportService } from "./modules/transport/service.js";
import { createTransportRouting } from "./modules/transport/routing.js";
import { createCommsService } from "./modules/comms/service.js";
import { createShopService } from "./modules/shop/service.js";
import { createCrewClothingService } from "./modules/crew-clothing/service.js";
import { createTaskService } from "./modules/tasks/service.js";
import { createFeedbackService } from "./modules/feedback/service.js";
import { createAdminService } from "./modules/admin/service.js";
import { createDashboardService } from "./modules/dashboard/service.js";
import { resolve } from "node:path";

const database = createDatabase(readDatabaseConfig());
const secureSettings = await createSecureSettingsStore(database, resolve(process.cwd(), "../var/secrets/settings.key"));
const crew = createCrewDirectoryService(database, secureSettings);
const auth = createAuthService(database);
const app = buildApp({
  auth,
  login: createAuthLoginService(database, auth),
  equipment: createEquipmentService(database),
  categories: createCategoryService(database),
  locations: createLocationService(database),
  warehouse: createWarehouseService(database),
  loans: createLoanService(database),
  crew,
  privateEquipment: createPrivateEquipmentService(database),
  requests: createEquipmentRequestService(database),
  vehicles: createVehicleService(database, createVegvesenVehicleDataService(database, secureSettings)),
  profiles: createProfileService(database),
  transport: createTransportService(database, createTransportRouting(database)),
  comms: createCommsService(database, crew),
  shop: createShopService(database),
  crewClothing: createCrewClothingService(database, crew),
  tasks: createTaskService(database),
  feedback: createFeedbackService(database, {
    writeRoot: resolve(process.cwd(), "../var"),
    mirrorWriteRoots: [resolve(process.cwd(), "../../V1/writable")],
    readRoots: [resolve(process.cwd(), "../../V1/writable")],
  }),
  admin: createAdminService(database, secureSettings),
  dashboard: createDashboardService(database),
  checkDatabase: async () => {
    const connection = await database.pool.getConnection();
    try {
      await connection.ping();
    } finally {
      connection.release();
    }
  },
});

let shuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "shutting down");

  try {
    await app.close();
    await database.pool.end();
    app.log.info({ signal }, "shutdown complete");
  } catch (error) {
    app.log.error({ error, signal }, "shutdown failed");
    process.exitCode = 1;
  }
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: "0.0.0.0", port: 3001 });
