import { buildApp } from "./app.js";
import { createDatabase, readDatabaseConfig } from "@bifrost/database";
import { createAuthService } from "./modules/auth/service.js";
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
import { resolve } from "node:path";

const database = createDatabase(readDatabaseConfig());
const secureSettings = await createSecureSettingsStore(database, resolve(process.cwd(), "../var/secrets/settings.key"));
const crew = createCrewDirectoryService(database, secureSettings);
const app = buildApp({
  auth: createAuthService(database),
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
  checkDatabase: async () => {
    const connection = await database.pool.getConnection();
    try {
      await connection.ping();
    } finally {
      connection.release();
    }
  },
});

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await database.pool.end();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: "0.0.0.0", port: 3001 });
