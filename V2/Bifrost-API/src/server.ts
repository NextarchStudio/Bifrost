import { buildApp } from "./app.js";
import { createDatabase, readDatabaseConfig } from "@bifrost/database";
import { createAuthService } from "./modules/auth/service.js";
import { createEquipmentService } from "./modules/equipment/service.js";
import { createCategoryService } from "./modules/categories/service.js";
import { createLocationService } from "./modules/locations/service.js";
import { createWarehouseService } from "./modules/warehouse/service.js";

const database = createDatabase(readDatabaseConfig());
const app = buildApp({
  auth: createAuthService(database),
  equipment: createEquipmentService(database),
  categories: createCategoryService(database),
  locations: createLocationService(database),
  warehouse: createWarehouseService(database),
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
