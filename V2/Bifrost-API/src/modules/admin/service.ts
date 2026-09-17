import type {
  AdminRole,
  AdminSettings,
  AdminStatistics,
  AdminUser,
  AdminWorkspaceResponse,
  VehicleCompetencyCode,
} from "@bifrost/contracts";
import {
  auditLogs,
  commsLoans,
  crewDirectoryCache,
  equipmentLoans,
  equipmentRequests,
  roles,
  shopMovements,
  systemSettings,
  userRoles,
  users,
  wannabeCompetencies,
  type DatabaseConnection,
} from "@bifrost/database";
import { asc, count, eq, inArray } from "drizzle-orm";
import type { SecureSettingsStore } from "../settings/secure-settings.js";
import { loadAdminStatistics } from "./statistics.js";

export const ADMIN_ROLES: ReadonlySet<string> = new Set(["developer", "chief", "co-chief"]);
export const SYSTEM_SETTINGS_ROLES: ReadonlySet<string> = new Set(["developer"]);
const PROTECTED_ROLE_NAMES: ReadonlySet<string> = new Set(["developer", "chief", "co-chief", "bruker"]);
const COMPETENCY_CODES = ["t1", "t2", "t3", "t4", "b", "be", "c1", "c1e", "c", "ce"] as const;

export interface AdminCreateUserInput { firstName: string; lastName: string; email: string; wannabeId?: number | null }
export interface AdminRoleInput { name: string; displayName?: string | null; wannabeRoleName?: string | null }
export interface AdminSettingsInput {
  appName: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  keycloakBaseUrl?: string | null;
  keycloakRealm?: string | null;
  keycloakClientId?: string | null;
  keycloakClientSecret?: string | null;
  keycloakRedirectUri?: string | null;
  smtpFromEmail?: string | null;
  smtpFromName?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  smtpCrypto?: "tls" | "ssl" | null;
  osrmBaseUrl?: string | null;
  vegvesenApiKey?: string | null;
  crewApiBaseUrl?: string | null;
  crewApiProfileEndpoint?: string | null;
  crewApiPictureEndpoint?: string | null;
  crewApiBearerToken?: string | null;
}

export class AdminDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT" | "FORBIDDEN") { super(message); }
}

export interface AdminService {
  workspace(canManageSettings: boolean): Promise<AdminWorkspaceResponse>;
  statistics(): Promise<AdminStatistics>;
  createUser(input: AdminCreateUserInput, actorUserId: number): Promise<{ id: number }>;
  setUserActive(userId: number, active: boolean, actorUserId: number): Promise<void>;
  syncUserRoles(userId: number, roleIds: number[], actorUserId: number): Promise<void>;
  updateUserCompetencies(userId: number, competencies: VehicleCompetencyCode[], actorUserId: number): Promise<void>;
  deleteUser(userId: number, actorUserId: number): Promise<void>;
  createRole(input: AdminRoleInput, actorUserId: number): Promise<{ id: number }>;
  updateRole(roleId: number, input: AdminRoleInput, actorUserId: number): Promise<void>;
  deleteRole(roleId: number, actorUserId: number): Promise<void>;
  updateSettings(input: AdminSettingsInput, actorUserId: number): Promise<void>;
}

type DatabaseTransaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];
type CompetencyRow = typeof wannabeCompetencies.$inferSelect;

export function createAdminService(database: DatabaseConnection, secureSettings: SecureSettingsStore): AdminService {
  return {
    async workspace(canManageSettings) {
      const [userRows, roleRows, assignments, competencyRows, cacheCountRows, settings] = await Promise.all([
        database.db.select().from(users).orderBy(asc(users.name)),
        database.db.select().from(roles).orderBy(asc(roles.name)),
        database.db.select({ userId: userRoles.userId, roleId: roles.id, name: roles.name, displayName: roles.displayName })
          .from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)),
        database.db.select().from(wannabeCompetencies),
        database.db.select({ total: count() }).from(crewDirectoryCache),
        canManageSettings ? loadSettings(database, secureSettings) : Promise.resolve(null),
      ]);
      const assignmentsByUser = new Map<number, typeof assignments>();
      for (const assignment of assignments) assignmentsByUser.set(assignment.userId, [...(assignmentsByUser.get(assignment.userId) ?? []), assignment]);
      const competenciesByWannabe = new Map(competencyRows.map((row) => [row.wannabeId, row]));
      const roleCountById = new Map<number, number>();
      for (const assignment of assignments) roleCountById.set(assignment.roleId, (roleCountById.get(assignment.roleId) ?? 0) + 1);
      return {
        canManageSettings,
        crewCacheEntries: Number(cacheCountRows[0]?.total ?? 0),
        roles: roleRows.map((role): AdminRole => ({
          id: role.id, name: role.name, displayName: role.displayName, wannabeRoleName: role.wannabeRoleName,
          protected: PROTECTED_ROLE_NAMES.has(role.name), userCount: roleCountById.get(role.id) ?? 0,
        })),
        users: userRows.map((user) => mapAdminUser(user, assignmentsByUser.get(user.id) ?? [], user.wannabeId ? competenciesByWannabe.get(user.wannabeId) : undefined)),
        settings,
      };
    },

    async statistics() { return loadAdminStatistics(database); },

    async createUser(input, actorUserId) {
      const firstName = plainText(input.firstName, 80);
      const lastName = plainText(input.lastName, 80);
      const email = input.email.trim().toLowerCase().slice(0, 180);
      if (!firstName || !lastName) throw new AdminDomainError("Fornavn og etternavn er påkrevd.", "CONFLICT");
      return database.db.transaction(async (tx) => {
        const [emailOwner] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
        if (emailOwner) throw new AdminDomainError("E-postadressen er allerede i bruk.", "CONFLICT");
        if (input.wannabeId) {
          const [wannabeOwner] = await tx.select({ id: users.id }).from(users).where(eq(users.wannabeId, input.wannabeId)).limit(1);
          if (wannabeOwner) throw new AdminDomainError("Wannabe ID er allerede i bruk.", "CONFLICT");
        }
        const now = new Date();
        const [created] = await tx.insert(users).values({
          name: `${firstName} ${lastName}`.trim().slice(0, 120), firstName, lastName, email,
          wannabeId: input.wannabeId ?? null, passwordHash: null, active: true, createdAt: now, updatedAt: now,
        }).$returningId();
        if (!created) throw new Error("Brukeren kunne ikke opprettes.");
        await writeAudit(tx, actorUserId, "create", "user", created.id, { email, provisioned_for_oidc: true });
        return { id: created.id };
      });
    },

    async setUserActive(userId, active, actorUserId) {
      if (userId === actorUserId && !active) throw new AdminDomainError("Du kan ikke deaktivere din egen bruker.", "CONFLICT");
      await database.db.transaction(async (tx) => {
        await requireUser(tx, userId);
        await tx.update(users).set({ active, updatedAt: new Date() }).where(eq(users.id, userId));
        await writeAudit(tx, actorUserId, "status", "user", userId, { active: active ? 1 : 0 });
      });
    },

    async syncUserRoles(userId, roleIds, actorUserId) {
      const uniqueIds = [...new Set(roleIds)];
      await database.db.transaction(async (tx) => {
        await requireUser(tx, userId);
        if (uniqueIds.length) {
          const existing = await tx.select({ id: roles.id }).from(roles).where(inArray(roles.id, uniqueIds));
          if (existing.length !== uniqueIds.length) throw new AdminDomainError("En eller flere roller finnes ikke.", "NOT_FOUND");
        }
        await tx.delete(userRoles).where(eq(userRoles.userId, userId));
        if (uniqueIds.length) await tx.insert(userRoles).values(uniqueIds.map((roleId) => ({ userId, roleId })));
        await writeAudit(tx, actorUserId, "sync_roles", "user", userId, { roles: uniqueIds });
      });
    },

    async updateUserCompetencies(userId, competencies, actorUserId) {
      await database.db.transaction(async (tx) => {
        const user = await requireUser(tx, userId);
        if (!user.wannabeId) throw new AdminDomainError("Brukeren må ha Wannabe ID før sertifikater kan lagres.", "CONFLICT");
        const selected = new Set(competencies);
        const flags = Object.fromEntries(COMPETENCY_CODES.map((code) => [code, selected.has(code)])) as Record<VehicleCompetencyCode, boolean>;
        const now = new Date();
        const [existing] = await tx.select({ id: wannabeCompetencies.id }).from(wannabeCompetencies).where(eq(wannabeCompetencies.wannabeId, user.wannabeId)).limit(1);
        const values = { ...flags, updatedAt: now };
        if (existing) await tx.update(wannabeCompetencies).set(values).where(eq(wannabeCompetencies.id, existing.id));
        else await tx.insert(wannabeCompetencies).values({ wannabeId: user.wannabeId, ...values, kdo: false, createdAt: now });
        await writeAudit(tx, actorUserId, "update_competencies", "user", userId, { wannabe_id: user.wannabeId, competencies: [...selected] });
      });
    },

    async deleteUser(userId, actorUserId) {
      if (userId === actorUserId) throw new AdminDomainError("Du kan ikke slette din egen bruker.", "CONFLICT");
      await database.db.transaction(async (tx) => {
        const user = await requireUser(tx, userId);
        const blockers = await userDeleteBlockers(tx, userId);
        if (blockers.length) throw new AdminDomainError(`Bruker kan ikke slettes fordi den er knyttet til: ${blockers.join(", ")}.`, "CONFLICT");
        await tx.delete(users).where(eq(users.id, userId));
        await writeAudit(tx, actorUserId, "delete", "user", userId, { email: user.email });
      });
    },

    async createRole(input, actorUserId) {
      const name = normalizeRoleName(input.name);
      if (!name) throw new AdminDomainError("Rollenavn er påkrevd.", "CONFLICT");
      return database.db.transaction(async (tx) => {
        const [duplicate] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1);
        if (duplicate) throw new AdminDomainError("Rollen finnes allerede.", "CONFLICT");
        const values = { name, displayName: nullableText(input.displayName, 100), wannabeRoleName: nullableText(input.wannabeRoleName, 100) };
        const [created] = await tx.insert(roles).values(values).$returningId();
        if (!created) throw new Error("Rollen kunne ikke opprettes.");
        await writeAudit(tx, actorUserId, "create", "role", created.id, values);
        return { id: created.id };
      });
    },

    async updateRole(roleId, input, actorUserId) {
      const name = normalizeRoleName(input.name);
      if (!name) throw new AdminDomainError("Rollenavn er påkrevd.", "CONFLICT");
      await database.db.transaction(async (tx) => {
        const [role] = await tx.select().from(roles).where(eq(roles.id, roleId)).limit(1).for("update");
        if (!role) throw new AdminDomainError("Rollen finnes ikke.", "NOT_FOUND");
        const [duplicate] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1);
        if (duplicate && duplicate.id !== roleId) throw new AdminDomainError("Et annet rollenavn bruker dette navnet allerede.", "CONFLICT");
        const values = { name, displayName: nullableText(input.displayName, 100), wannabeRoleName: nullableText(input.wannabeRoleName, 100) };
        await tx.update(roles).set(values).where(eq(roles.id, roleId));
        await writeAudit(tx, actorUserId, "update", "role", roleId, values);
      });
    },

    async deleteRole(roleId, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [role] = await tx.select().from(roles).where(eq(roles.id, roleId)).limit(1).for("update");
        if (!role) throw new AdminDomainError("Rollen finnes ikke.", "NOT_FOUND");
        if (PROTECTED_ROLE_NAMES.has(role.name)) throw new AdminDomainError("Denne rollen er beskyttet og kan ikke slettes.", "CONFLICT");
        const [usage] = await tx.select({ total: count() }).from(userRoles).where(eq(userRoles.roleId, roleId));
        if (Number(usage?.total ?? 0) > 0) throw new AdminDomainError("Rollen kan ikke slettes fordi den er i bruk av en eller flere brukere.", "CONFLICT");
        await tx.delete(roles).where(eq(roles.id, roleId));
        await writeAudit(tx, actorUserId, "delete", "role", roleId, { name: role.name });
      });
    },

    async updateSettings(input, actorUserId) {
      const secretChanges: string[] = [];
      for (const [key, value] of [
        ["oidc.client_secret", input.keycloakClientSecret],
        ["smtp.password", input.smtpPassword],
        ["vegvesen.api_key", input.vegvesenApiKey],
        ["crew.api_bearer_token", input.crewApiBearerToken],
      ] as const) {
        const secret = value?.trim();
        if (!secret) continue;
        await secureSettings.set(key, secret, actorUserId);
        secretChanges.push(key);
      }
      const values = {
        appName: plainText(input.appName, 120) || "Bifrost",
        enableLocalLogin: false,
        enableKeycloakLogin: true,
        logoUrl: nullableText(input.logoUrl, 255), faviconUrl: nullableText(input.faviconUrl, 255),
        keycloakBaseUrl: nullableText(input.keycloakBaseUrl, 255), keycloakRealm: nullableText(input.keycloakRealm, 120),
        keycloakClientId: nullableText(input.keycloakClientId, 180), keycloakRedirectUri: nullableText(input.keycloakRedirectUri, 255),
        smtpFromEmail: nullableText(input.smtpFromEmail, 180), smtpFromName: nullableText(input.smtpFromName, 180),
        smtpHost: nullableText(input.smtpHost, 180), smtpPort: input.smtpPort ?? null, smtpUser: nullableText(input.smtpUser, 180),
        smtpCrypto: input.smtpCrypto ?? null, osrmBaseUrl: nullableText(input.osrmBaseUrl, 255),
        crewApiBaseUrl: nullableText(input.crewApiBaseUrl, 255),
        crewApiProfileEndpoint: normalizeEndpoint(input.crewApiProfileEndpoint),
        crewApiPictureEndpoint: normalizeEndpoint(input.crewApiPictureEndpoint),
      };
      await database.db.transaction(async (tx) => {
        await tx.update(systemSettings).set(values).where(eq(systemSettings.id, 1));
        await writeAudit(tx, actorUserId, "update", "system_settings", 1, { ...values, encrypted_settings_changed: secretChanges });
      });
    },
  };
}

async function loadSettings(database: DatabaseConnection, secureStore: SecureSettingsStore): Promise<AdminSettings> {
  const [row, oidcSecret, smtpPassword, vegvesenKey, crewToken] = await Promise.all([
    database.db.select().from(systemSettings).where(eq(systemSettings.id, 1)).limit(1).then((rows) => rows[0]),
    secureStore.get("oidc.client_secret"), secureStore.get("smtp.password"), secureStore.get("vegvesen.api_key"), secureStore.get("crew.api_bearer_token"),
  ]);
  if (!row) throw new AdminDomainError("Systeminnstillinger finnes ikke.", "NOT_FOUND");
  return {
    appName: row.appName?.trim() || "Bifrost", logoUrl: row.logoUrl, faviconUrl: row.faviconUrl,
    keycloakBaseUrl: row.keycloakBaseUrl, keycloakRealm: row.keycloakRealm, keycloakClientId: row.keycloakClientId, keycloakRedirectUri: row.keycloakRedirectUri,
    smtpFromEmail: row.smtpFromEmail, smtpFromName: row.smtpFromName, smtpHost: row.smtpHost, smtpPort: row.smtpPort,
    smtpUser: row.smtpUser, smtpCrypto: row.smtpCrypto === "ssl" ? "ssl" : row.smtpCrypto === "tls" ? "tls" : null,
    osrmBaseUrl: row.osrmBaseUrl, crewApiBaseUrl: row.crewApiBaseUrl, crewApiProfileEndpoint: row.crewApiProfileEndpoint,
    crewApiPictureEndpoint: row.crewApiPictureEndpoint, crewCacheYear: row.crewCacheYear,
    hasOidcClientSecret: Boolean(oidcSecret), hasSmtpPassword: Boolean(smtpPassword), hasVegvesenApiKey: Boolean(vegvesenKey), hasCrewApiBearerToken: Boolean(crewToken),
  };
}

function mapAdminUser(user: typeof users.$inferSelect, assignments: Array<{ roleId: number; name: string; displayName: string | null }>, competency?: CompetencyRow): AdminUser {
  return {
    id: user.id, name: user.name, firstName: user.firstName, lastName: user.lastName, email: user.email,
    wannabeId: user.wannabeId, badgeScanNumber: user.badgeScanNumber, active: user.active,
    roleIds: assignments.map((role) => role.roleId), roleNames: assignments.map((role) => role.name),
    roleDisplayNames: assignments.map((role) => role.displayName?.trim() || role.name),
    competencies: competency ? COMPETENCY_CODES.filter((code) => competency[code]) : [],
    createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(),
  };
}

async function requireUser(tx: DatabaseTransaction, userId: number) {
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1).for("update");
  if (!user) throw new AdminDomainError("Bruker finnes ikke.", "NOT_FOUND");
  return user;
}

async function userDeleteBlockers(tx: DatabaseTransaction, userId: number): Promise<string[]> {
  const rows = await Promise.all([
    tx.select({ total: count() }).from(equipmentLoans).where(eq(equipmentLoans.issuedByUserId, userId)),
    tx.select({ total: count() }).from(equipmentRequests).where(eq(equipmentRequests.requesterUserId, userId)),
    tx.select({ total: count() }).from(auditLogs).where(eq(auditLogs.actorUserId, userId)),
    tx.select({ total: count() }).from(shopMovements).where(eq(shopMovements.actorUserId, userId)),
    tx.select({ total: count() }).from(commsLoans).where(eq(commsLoans.issuedByUserId, userId)),
  ]);
  return ["utlån", "forespørsler", "auditlogg", "shop-bevegelser", "sambandsutlån"].filter((_name, index) => Number(rows[index]?.[0]?.total ?? 0) > 0);
}

function normalizeRoleName(value: string): string { return plainText(value, 100).toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "").slice(0, 50); }
function plainText(value: string, limit: number): string { return value.replace(/<[^>]*>/g, "").trim().slice(0, limit); }
function nullableText(value: string | null | undefined, limit: number): string | null { const clean = plainText(value ?? "", limit); return clean || null; }
function normalizeEndpoint(value: string | null | undefined): string { const clean = (value ?? "").trim().replace(/^\/+|\/+$/g, ""); return clean ? `/${clean}/` : "/"; }
async function writeAudit(tx: DatabaseTransaction, actorUserId: number, action: string, entityType: string, entityId: number, diffJson: unknown): Promise<void> {
  await tx.insert(auditLogs).values({ actorUserId, action, entityType, entityId, diffJson, createdAt: new Date() });
}
