import { bigint, boolean, datetime, int, json, mysqlTable, primaryKey, smallint, text, tinyint, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: bigint({ mode: "number", unsigned: true }).primaryKey().autoincrement(),
  name: varchar({ length: 120 }).notNull(),
  firstName: varchar("first_name", { length: 80 }).notNull(),
  lastName: varchar("last_name", { length: 80 }).notNull(),
  email: varchar({ length: 180 }).notNull(),
  wannabeId: bigint("wannabe_id", { mode: "number", unsigned: true }),
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
});

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
