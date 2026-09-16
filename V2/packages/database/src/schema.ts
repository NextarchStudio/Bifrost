import { bigint, boolean, datetime, decimal, int, json, mysqlTable, primaryKey, smallint, text, tinyint, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: bigint({ mode: "number", unsigned: true }).primaryKey().autoincrement(),
  name: varchar({ length: 120 }).notNull(),
  firstName: varchar("first_name", { length: 80 }).notNull(),
  lastName: varchar("last_name", { length: 80 }).notNull(),
  email: varchar({ length: 180 }).notNull(),
  wannabeId: bigint("wannabe_id", { mode: "number", unsigned: true }),
  badgeScanNumber: varchar("badge_scan_number", { length: 64 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  active: boolean().notNull().default(true),
  createdAt: datetime("created_at", { mode: "date" }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const roles = mysqlTable("roles", {
  id: smallint({ unsigned: true }).primaryKey().autoincrement(),
  name: varchar({ length: 50 }).notNull(),
  wannabeRoleName: varchar("wannabe_role_name", { length: 100 }),
  displayName: varchar("display_name", { length: 100 }),
}, (table) => [uniqueIndex("roles_name_unique").on(table.name)]);

export const userRoles = mysqlTable("user_roles", {
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  roleId: smallint("role_id", { unsigned: true }).notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.roleId] })]);

export const authAccounts = mysqlTable("auth_accounts", {
  id: bigint({ mode: "number", unsigned: true }).primaryKey().autoincrement(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  provider: varchar({ length: 30 }).notNull(),
  providerId: varchar("provider_id", { length: 191 }).notNull(),
});

export const systemSettings = mysqlTable("system_settings", {
  id: tinyint({ unsigned: true }).primaryKey(),
  appName: varchar("app_name", { length: 120 }),
  enableLocalLogin: boolean("enable_local_login").notNull().default(false),
  enableKeycloakLogin: boolean("enable_keycloak_login").notNull().default(true),
  keycloakBaseUrl: varchar("keycloak_base_url", { length: 255 }),
  keycloakRealm: varchar("keycloak_realm", { length: 120 }),
  keycloakClientId: varchar("keycloak_client_id", { length: 180 }),
  keycloakClientSecret: varchar("keycloak_client_secret", { length: 255 }),
  keycloakRedirectUri: varchar("keycloak_redirect_uri", { length: 255 }),
  crewApiBaseUrl: varchar("crew_api_base_url", { length: 255 }),
  crewApiProfileEndpoint: varchar("crew_api_profile_endpoint", { length: 255 }),
  crewApiPictureEndpoint: varchar("crew_api_picture_endpoint", { length: 255 }),
  smtpPass: varchar("smtp_pass", { length: 255 }),
  googleMapsApiKey: varchar("google_maps_api_key", { length: 255 }),
  vegvesenApiKey: varchar("vegvesen_api_key", { length: 255 }),
  crewApiBearerToken: text("crew_api_bearer_token"),
  crewCacheYear: int("crew_cache_year"),
});

export const crewDirectoryCache = mysqlTable("crew_directory_cache", {
  id: int({ unsigned: true }).primaryKey().autoincrement(),
  wannabeId: int("wannabe_id", { unsigned: true }).notNull(),
  scanNumber: varchar("scan_number", { length: 64 }),
  name: varchar({ length: 255 }),
  nickname: varchar({ length: 255 }),
  crewName: varchar("crew_name", { length: 255 }),
  crewRoleTitle: varchar("crew_role_title", { length: 255 }),
  crewRoleName: varchar("crew_role_name", { length: 255 }),
  createdAt: datetime("created_at", { mode: "date" }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull(),
}, (table) => [
  uniqueIndex("crew_directory_cache_wannabe_id_unique").on(table.wannabeId),
  uniqueIndex("crew_directory_cache_scan_number_unique").on(table.scanNumber),
]);

export const equipment = mysqlTable("equipment", {
  id: bigint({ mode: "number", unsigned: true }).primaryKey().autoincrement(),
  name: varchar({ length: 150 }).notNull(),
  category: varchar({ length: 80 }).notNull(),
  serialNumber: varchar("serial_number", { length: 150 }).notNull(),
  quantity: int({ unsigned: true }).notNull().default(1),
  status: varchar({ length: 30 }).notNull(),
  palletSlotId: int("pallet_slot_id", { unsigned: true }),
  notes: text(),
  createdAt: datetime("created_at", { mode: "date" }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull(),
});

export const equipmentCategories = mysqlTable("equipment_categories", {
  id: int({ unsigned: true }).primaryKey().autoincrement(),
  name: varchar({ length: 80 }).notNull(),
  createdAt: datetime("created_at", { mode: "date" }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull(),
}, (table) => [uniqueIndex("equipment_categories_name_unique").on(table.name)]);

export const privateEquipmentPrefixes = mysqlTable("private_equipment_prefixes", {
  id: int({ unsigned: true }).primaryKey().autoincrement(),
  ownerName: varchar("owner_name", { length: 180 }).notNull(),
  barcodePrefix: varchar("barcode_prefix", { length: 120 }).notNull(),
  createdAt: datetime("created_at", { mode: "date" }),
  updatedAt: datetime("updated_at", { mode: "date" }),
}, (table) => [
  uniqueIndex("private_equipment_prefixes_barcode_prefix_unique").on(table.barcodePrefix),
]);

export const locations = mysqlTable("locations", {
  id: int({ unsigned: true }).primaryKey().autoincrement(),
  name: varchar({ length: 120 }).notNull(),
  type: varchar({ length: 50 }).notNull(),
  address: varchar({ length: 255 }),
  latitude: decimal({ precision: 10, scale: 7 }),
  longitude: decimal({ precision: 10, scale: 7 }),
});

export const pallets = mysqlTable("pallets", {
  id: int({ unsigned: true }).primaryKey().autoincrement(),
  locationId: int("location_id", { unsigned: true }).notNull(),
  name: varchar({ length: 80 }).notNull(),
  qrCode: varchar("qr_code", { length: 120 }),
});

export const palletSlots = mysqlTable("pallet_slots", {
  id: int({ unsigned: true }).primaryKey().autoincrement(),
  palletId: int("pallet_id", { unsigned: true }).notNull(),
  slotNumber: smallint("slot_number", { unsigned: true }).notNull(),
  status: varchar({ length: 20 }).notNull(),
});

export const equipmentLoans = mysqlTable("equipment_loans", {
  id: bigint({ mode: "number", unsigned: true }).primaryKey().autoincrement(),
  equipmentId: bigint("equipment_id", { mode: "number", unsigned: true }).notNull(),
  wannabeId: bigint("wannabe_id", { mode: "number", unsigned: true }).notNull(),
  quantity: int({ unsigned: true }).notNull().default(1),
  requestId: bigint("request_id", { mode: "number", unsigned: true }),
  issuedByUserId: bigint("issued_by_user_id", { mode: "number", unsigned: true }).notNull(),
  issuedAt: datetime("issued_at", { mode: "date" }).notNull(),
  returnedAt: datetime("returned_at", { mode: "date" }),
  status: varchar({ length: 20 }).notNull(),
});

export const transportJobs = mysqlTable("transport_jobs", {
  id: bigint({ mode: "number", unsigned: true }).primaryKey().autoincrement(),
  fromLocationId: int("from_location_id", { unsigned: true }).notNull(),
  toLocationId: int("to_location_id", { unsigned: true }).notNull(),
  status: varchar({ length: 20 }).notNull(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: bigint({ mode: "number", unsigned: true }).primaryKey().autoincrement(),
  actorUserId: bigint("actor_user_id", { mode: "number", unsigned: true }).notNull(),
  action: varchar({ length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 60 }).notNull(),
  entityId: bigint("entity_id", { mode: "number", unsigned: true }).notNull(),
  diffJson: json("diff_json"),
  createdAt: datetime("created_at", { mode: "date" }).notNull(),
});

export const equipmentRequests = mysqlTable("equipment_requests", {
  id: bigint({ mode: "number", unsigned: true }).primaryKey().autoincrement(),
  requesterUserId: bigint("requester_user_id", { mode: "number", unsigned: true }).notNull(),
  wannabeId: bigint("wannabe_id", { mode: "number", unsigned: true }).notNull(),
  title: varchar({ length: 150 }).notNull(),
  notes: text(),
  status: varchar({ length: 20 }).notNull().default("pending"),
  createdAt: datetime("created_at", { mode: "date" }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull(),
});

export const equipmentRequestItems = mysqlTable("equipment_request_items", {
  id: bigint({ mode: "number", unsigned: true }).primaryKey().autoincrement(),
  requestId: bigint("request_id", { mode: "number", unsigned: true }).notNull(),
  equipmentId: bigint("equipment_id", { mode: "number", unsigned: true }).notNull(),
  quantity: smallint({ unsigned: true }).notNull().default(1),
  note: varchar({ length: 255 }),
  approvedQuantity: smallint("approved_quantity", { unsigned: true }).notNull().default(0),
  itemStatus: varchar("item_status", { length: 20 }).notNull().default("pending"),
});

export const secureSettings = mysqlTable("bifrost_secure_settings", {
  key: varchar({ length: 120 }).primaryKey(),
  encryptedValue: text("encrypted_value").notNull(),
  keyVersion: smallint("key_version", { unsigned: true }).notNull().default(1),
  updatedByUserId: bigint("updated_by_user_id", { mode: "number", unsigned: true }),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull(),
});

export const jobs = mysqlTable("bifrost_jobs", {
  id: bigint({ mode: "number", unsigned: true }).primaryKey().autoincrement(),
  type: varchar({ length: 80 }).notNull(),
  status: varchar({ length: 20 }).notNull().default("pending"),
  payload: json(),
  attempts: int({ unsigned: true }).notNull().default(0),
  availableAt: datetime("available_at", { mode: "date" }).notNull(),
  lockedAt: datetime("locked_at", { mode: "date" }),
  lockedBy: varchar("locked_by", { length: 120 }),
  lastError: text("last_error"),
  createdAt: datetime("created_at", { mode: "date" }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull(),
});
