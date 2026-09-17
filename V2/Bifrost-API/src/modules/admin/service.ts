import { BIFROST_ACCESS } from "@bifrost/contracts";
import type {
  AdminCrewProvisionResult,
  AdminRole,
  AdminCrewResetPreview,
  AdminSettings,
  AdminStatistics,
  AdminUser,
  AdminWorkspaceResponse,
  CrewProfile,
  CrewProvisioningRule,
  VehicleCompetencyCode,
} from "@bifrost/contracts";
import {
  auditLogs,
  commsLoans,
  crewProvisioningRules,
  crewDirectoryCache,
  equipmentLoans,
  equipmentRequests,
  jobs,
  roles,
  shopMovements,
  systemSettings,
  userRoles,
  users,
  wannabeCompetencies,
  webOrigins,
  type DatabaseConnection,
} from "@bifrost/database";
import { asc, count, eq, inArray } from "drizzle-orm";
import type { SecureSettingsStore } from "../settings/secure-settings.js";
import { loadAdminStatistics } from "./statistics.js";
import { loadCrewResetPreview, resetCrewData } from "./crew-reset.js";
import { loadActiveWebOrigins } from "../settings/web-origins.js";
import type { CrewDirectoryService } from "../crew/service.js";

export const ADMIN_ROLES = BIFROST_ACCESS.admin;
export const SYSTEM_SETTINGS_ROLES = BIFROST_ACCESS.systemSettings;
const PROTECTED_ROLE_NAMES: ReadonlySet<string> = new Set(["developer", "chief", "co-chief", "bruker"]);
const COMPETENCY_CODES = ["t1", "t2", "t3", "t4", "b", "be", "c1", "c1e", "c", "ce"] as const;

export interface AdminCreateUserInput { firstName: string; lastName: string; email: string; wannabeId?: number | null; badgeScanNumber?: string | null }
export interface AdminRoleInput { name: string; displayName?: string | null; wannabeRoleName?: string | null }
export interface CrewProvisioningRuleInput { crewName: string; crewRole?: string | null; roleId: number; enabled: boolean }
export interface AdminSettingsInput {
  appName: string;
  localLoginEnabled: boolean;
  crewProvisioningEmailEnabled: boolean;
  webOrigins: string[];
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
  crewResetPreview(): Promise<AdminCrewResetPreview>;
  clearCrewCache(confirmation: string, actorUserId: number): Promise<AdminCrewResetPreview>;
  provisionCrewUser(lookup: string, actorUserId: number, emailOverride?: string | null, lookupType?: "badge" | "wannabe"): Promise<AdminCrewProvisionResult>;
  createUser(input: AdminCreateUserInput, actorUserId: number): Promise<{ id: number }>;
  setUserActive(userId: number, active: boolean, actorUserId: number): Promise<void>;
  syncUserRoles(userId: number, roleIds: number[], actorUserId: number): Promise<void>;
  updateUserCompetencies(userId: number, competencies: VehicleCompetencyCode[], actorUserId: number): Promise<void>;
  deleteUser(userId: number, actorUserId: number): Promise<void>;
  createRole(input: AdminRoleInput, actorUserId: number): Promise<{ id: number }>;
  updateRole(roleId: number, input: AdminRoleInput, actorUserId: number): Promise<void>;
  deleteRole(roleId: number, actorUserId: number): Promise<void>;
  createCrewProvisioningRule(input: CrewProvisioningRuleInput, actorUserId: number): Promise<{ id: number }>;
  updateCrewProvisioningRule(ruleId: number, input: CrewProvisioningRuleInput, actorUserId: number): Promise<void>;
  deleteCrewProvisioningRule(ruleId: number, actorUserId: number): Promise<void>;
  setCrewProvisioningEmailEnabled(enabled: boolean, actorUserId: number): Promise<void>;
  updateSettings(input: AdminSettingsInput, actorUserId: number): Promise<void>;
}

type DatabaseTransaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];
type CompetencyRow = typeof wannabeCompetencies.$inferSelect;
type CrewRuleViewRow = {
  id: number;
  crewName: string;
  crewRole: string | null;
  roleId: number;
  roleName: string;
  roleDisplayName: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function createAdminService(
  database: DatabaseConnection,
  secureSettings: SecureSettingsStore,
  crew: CrewDirectoryService,
): AdminService {
  return {
    async workspace(canManageSettings) {
      const [userRows, roleRows, assignments, competencyRows, cacheCountRows, provisioningRuleRows, settings] = await Promise.all([
        database.db.select().from(users).orderBy(asc(users.name)),
        database.db.select().from(roles).orderBy(asc(roles.name)),
        database.db.select({ userId: userRoles.userId, roleId: roles.id, name: roles.name, displayName: roles.displayName })
          .from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)),
        database.db.select().from(wannabeCompetencies),
        database.db.select({ total: count() }).from(crewDirectoryCache),
        database.db.select({
          id: crewProvisioningRules.id,
          crewName: crewProvisioningRules.crewName,
          crewRole: crewProvisioningRules.crewRole,
          roleId: roles.id,
          roleName: roles.name,
          roleDisplayName: roles.displayName,
          enabled: crewProvisioningRules.enabled,
          createdAt: crewProvisioningRules.createdAt,
          updatedAt: crewProvisioningRules.updatedAt,
        }).from(crewProvisioningRules).innerJoin(roles, eq(roles.id, crewProvisioningRules.roleId))
          .orderBy(asc(crewProvisioningRules.crewName), asc(crewProvisioningRules.crewRole), asc(roles.name)),
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
        crewProvisioningRules: provisioningRuleRows.map(mapCrewProvisioningRule),
        roles: roleRows.map((role): AdminRole => ({
          id: role.id, name: role.name, displayName: role.displayName, wannabeRoleName: role.wannabeRoleName,
          protected: PROTECTED_ROLE_NAMES.has(role.name), userCount: roleCountById.get(role.id) ?? 0,
        })),
        users: userRows.map((user) => mapAdminUser(user, assignmentsByUser.get(user.id) ?? [], user.wannabeId ? competenciesByWannabe.get(user.wannabeId) : undefined)),
        settings,
      };
    },

    async statistics() { return loadAdminStatistics(database); },
    async crewResetPreview() { return loadCrewResetPreview(database); },
    async clearCrewCache(confirmation, actorUserId) { return resetCrewData(database, confirmation, actorUserId); },

    async provisionCrewUser(lookupValue, actorUserId, emailOverride, lookupType = "badge") {
      const lookup = plainText(lookupValue, 64);
      if (!lookup) throw new AdminDomainError("Badge eller Wannabe-ID mangler.", "CONFLICT");
      const badge = lookupType === "badge" ? lookup : null;
      const profile = await crew.lookup(lookup, lookupType, true);
      const splitName = splitPersonName(profile.name);
      const firstName = plainText(profile.firstName || splitName.firstName, 80);
      const lastName = plainText(profile.lastName || splitName.lastName, 80);
      if (!firstName || !lastName) {
        throw new AdminDomainError("Crew API må returnere fullt navn og Wannabe-ID før brukeren kan opprettes.", "CONFLICT");
      }

      const [[wannabeUser], badgeUsers] = await Promise.all([
        database.db.select({ id: users.id, email: users.email }).from(users).where(eq(users.wannabeId, profile.id)).limit(1),
        badge
          ? database.db.select({ id: users.id, email: users.email }).from(users).where(eq(users.badgeScanNumber, badge)).limit(1)
          : Promise.resolve([]),
      ]);
      const badgeUser = badgeUsers[0];
      if (wannabeUser && badgeUser && wannabeUser.id !== badgeUser.id) {
        throw new AdminDomainError("Wannabe-ID og badge tilhører forskjellige brukere.", "CONFLICT");
      }
      const existingEmail = wannabeUser?.email || badgeUser?.email || "";
      const email = normalizeEmail(profile.email || existingEmail || emailOverride || "");
      if (!email) {
        throw new AdminDomainError("Crew API returnerer ikke e-post for denne brukeren. Oppgi e-post for å fullføre opprettelsen.", "CONFLICT");
      }

      const ruleRows = await database.db.select({
        id: crewProvisioningRules.id,
        crewName: crewProvisioningRules.crewName,
        crewRole: crewProvisioningRules.crewRole,
        roleId: roles.id,
        roleName: roles.name,
      }).from(crewProvisioningRules).innerJoin(roles, eq(roles.id, crewProvisioningRules.roleId))
        .where(eq(crewProvisioningRules.enabled, true));
      const matchedRules = ruleRows.filter((rule) => crewProvisioningRuleMatches(profile, rule));
      if (!matchedRules.length) {
        const identity = [profile.crewName, profile.role].filter(Boolean).join(", ") || "ukjent crew";
        throw new AdminDomainError(`Ingen aktiv provisjoneringsregel matcher ${identity}.`, "FORBIDDEN");
      }

      const [defaultRole] = await database.db.select({ id: roles.id, name: roles.name }).from(roles)
        .where(eq(roles.name, "bruker")).limit(1);
      const roleAssignments = new Map(matchedRules.map((rule) => [rule.roleId, rule.roleName]));
      if (defaultRole) roleAssignments.set(defaultRole.id, defaultRole.name);

      const provisioned = await database.db.transaction(async (tx) => {
        const [[wannabeOwner], [emailOwner], badgeOwners] = await Promise.all([
          tx.select({ id: users.id }).from(users).where(eq(users.wannabeId, profile.id)).limit(1),
          tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1),
          badge
            ? tx.select({ id: users.id }).from(users).where(eq(users.badgeScanNumber, badge)).limit(1)
            : Promise.resolve([]),
        ]);
        const badgeOwner = badgeOwners[0];
        const ownerIds = new Set([wannabeOwner?.id, emailOwner?.id, badgeOwner?.id].filter((id): id is number => Boolean(id)));
        if (ownerIds.size > 1) throw new AdminDomainError("Wannabe-ID, e-post eller badge tilhører forskjellige brukere.", "CONFLICT");

        const now = new Date();
        let userId = [...ownerIds][0];
        const created = !userId;
        if (userId) {
          await tx.update(users).set({
            name: `${firstName} ${lastName}`.trim().slice(0, 120),
            firstName,
            lastName,
            email,
            wannabeId: profile.id,
            ...(badge ? { badgeScanNumber: badge } : {}),
            active: true,
            updatedAt: now,
          }).where(eq(users.id, userId));
        } else {
          const [createdUser] = await tx.insert(users).values({
            name: `${firstName} ${lastName}`.trim().slice(0, 120),
            firstName,
            lastName,
            email,
            wannabeId: profile.id,
            badgeScanNumber: badge,
            passwordHash: null,
            active: true,
            createdAt: now,
            updatedAt: now,
          }).$returningId();
          if (!createdUser) throw new Error("Crew-brukeren kunne ikke opprettes.");
          userId = createdUser.id;
        }
        if (!userId) throw new Error("Crew-brukeren mangler intern ID.");

        const existingRoles = await tx.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId));
        const existingRoleIds = new Set(existingRoles.map((assignment) => assignment.roleId));
        const missingRoleIds = [...roleAssignments.keys()].filter((roleId) => !existingRoleIds.has(roleId));
        if (missingRoleIds.length) await tx.insert(userRoles).values(missingRoleIds.map((roleId) => ({ userId, roleId })));

        const [settings] = await tx.select({ emailEnabled: systemSettings.crewProvisioningEmailEnabled })
          .from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
        const emailQueued = created && Boolean(settings?.emailEnabled);
        if (emailQueued) await tx.insert(jobs).values({
          type: "send_user_welcome_email",
          status: "pending",
          payload: { userId },
          attempts: 0,
          availableAt: now,
          createdAt: now,
          updatedAt: now,
        });
        await writeAudit(tx, actorUserId, created ? "crew_provision_create" : "crew_provision_sync", "user", userId, {
          wannabe_id: profile.id,
          lookup_type: lookupType,
          crew_name: profile.crewName,
          crew_role: profile.role,
          assigned_roles: [...roleAssignments.values()],
          email_queued: emailQueued,
        });
        return { userId, created, emailQueued };
      });

      const user = await loadAdminUser(database, provisioned.userId);
      if (!user) throw new AdminDomainError("Den provisjonerte brukeren kunne ikke lastes.", "NOT_FOUND");
      return {
        ...provisioned,
        profile,
        user,
        matchedRoles: [...roleAssignments.values()],
      };
    },

    async createUser(input, actorUserId) {
      const firstName = plainText(input.firstName, 80);
      const lastName = plainText(input.lastName, 80);
      const email = input.email.trim().toLowerCase().slice(0, 180);
      const badgeScanNumber = nullableText(input.badgeScanNumber, 64);
      if (!firstName || !lastName) throw new AdminDomainError("Fornavn og etternavn er påkrevd.", "CONFLICT");
      return database.db.transaction(async (tx) => {
        const [emailOwner] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
        if (emailOwner) throw new AdminDomainError("E-postadressen er allerede i bruk.", "CONFLICT");
        if (input.wannabeId) {
          const [wannabeOwner] = await tx.select({ id: users.id }).from(users).where(eq(users.wannabeId, input.wannabeId)).limit(1);
          if (wannabeOwner) throw new AdminDomainError("Wannabe ID er allerede i bruk.", "CONFLICT");
        }
        if (badgeScanNumber) {
          const [badgeOwner] = await tx.select({ id: users.id }).from(users).where(eq(users.badgeScanNumber, badgeScanNumber)).limit(1);
          if (badgeOwner) throw new AdminDomainError("Badge-scannen er allerede i bruk.", "CONFLICT");
        }
        const now = new Date();
        const [created] = await tx.insert(users).values({
          name: `${firstName} ${lastName}`.trim().slice(0, 120), firstName, lastName, email,
          wannabeId: input.wannabeId ?? null, badgeScanNumber, passwordHash: null, active: true, createdAt: now, updatedAt: now,
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
        const [[usage], [crewUsage]] = await Promise.all([
          tx.select({ total: count() }).from(userRoles).where(eq(userRoles.roleId, roleId)),
          tx.select({ total: count() }).from(crewProvisioningRules).where(eq(crewProvisioningRules.roleId, roleId)),
        ]);
        if (Number(usage?.total ?? 0) > 0) throw new AdminDomainError("Rollen kan ikke slettes fordi den er i bruk av en eller flere brukere.", "CONFLICT");
        if (Number(crewUsage?.total ?? 0) > 0) throw new AdminDomainError("Rollen kan ikke slettes fordi den brukes av en Crew-regel.", "CONFLICT");
        await tx.delete(roles).where(eq(roles.id, roleId));
        await writeAudit(tx, actorUserId, "delete", "role", roleId, { name: role.name });
      });
    },

    async createCrewProvisioningRule(input, actorUserId) {
      const values = normalizeCrewProvisioningRule(input);
      return database.db.transaction(async (tx) => {
        await requireRole(tx, values.roleId);
        await requireUniqueCrewRule(tx, values);
        const now = new Date();
        const [created] = await tx.insert(crewProvisioningRules).values({ ...values, createdAt: now, updatedAt: now }).$returningId();
        if (!created) throw new Error("Crew-regelen kunne ikke opprettes.");
        await writeAudit(tx, actorUserId, "create", "crew_provisioning_rule", created.id, values);
        return { id: created.id };
      });
    },

    async updateCrewProvisioningRule(ruleId, input, actorUserId) {
      const values = normalizeCrewProvisioningRule(input);
      await database.db.transaction(async (tx) => {
        const [rule] = await tx.select({ id: crewProvisioningRules.id }).from(crewProvisioningRules)
          .where(eq(crewProvisioningRules.id, ruleId)).limit(1).for("update");
        if (!rule) throw new AdminDomainError("Crew-regelen finnes ikke.", "NOT_FOUND");
        await requireRole(tx, values.roleId);
        await requireUniqueCrewRule(tx, values, ruleId);
        await tx.update(crewProvisioningRules).set({ ...values, updatedAt: new Date() }).where(eq(crewProvisioningRules.id, ruleId));
        await writeAudit(tx, actorUserId, "update", "crew_provisioning_rule", ruleId, values);
      });
    },

    async deleteCrewProvisioningRule(ruleId, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [rule] = await tx.select().from(crewProvisioningRules).where(eq(crewProvisioningRules.id, ruleId)).limit(1).for("update");
        if (!rule) throw new AdminDomainError("Crew-regelen finnes ikke.", "NOT_FOUND");
        await tx.delete(crewProvisioningRules).where(eq(crewProvisioningRules.id, ruleId));
        await writeAudit(tx, actorUserId, "delete", "crew_provisioning_rule", ruleId, {
          crew_name: rule.crewName,
          crew_role: rule.crewRole,
          role_id: rule.roleId,
        });
      });
    },

    async setCrewProvisioningEmailEnabled(enabled, actorUserId) {
      const [settings, smtpPassword] = await Promise.all([
        database.db.select({
          fromEmail: systemSettings.smtpFromEmail,
          host: systemSettings.smtpHost,
          port: systemSettings.smtpPort,
          username: systemSettings.smtpUser,
        }).from(systemSettings).where(eq(systemSettings.id, 1)).limit(1).then((rows) => rows[0]),
        enabled ? secureSettings.get("smtp.password") : Promise.resolve(null),
      ]);
      if (!settings) throw new AdminDomainError("Systeminnstillinger finnes ikke.", "NOT_FOUND");
      validateWelcomeEmailConfiguration({ enabled, ...settings }, Boolean(smtpPassword));
      await database.db.transaction(async (tx) => {
        await tx.update(systemSettings).set({ crewProvisioningEmailEnabled: enabled }).where(eq(systemSettings.id, 1));
        await writeAudit(tx, actorUserId, "update", "system_settings", 1, { crew_provisioning_email_enabled: enabled });
      });
    },

    async updateSettings(input, actorUserId) {
      const normalizedWebOrigins = normalizeWebOrigins(input.webOrigins);
      const currentWebOriginConfig = await loadActiveWebOrigins(database);
      const bootstrapOriginsUnchanged = normalizedWebOrigins.length === currentWebOriginConfig.origins.length
        && normalizedWebOrigins.every((origin) => currentWebOriginConfig.origins.includes(origin));
      if (currentWebOriginConfig.usingBootstrapFallback && !bootstrapOriginsUnchanged) {
        throw new AdminDomainError("Migrering 0003 må kjøres før Web-domener kan endres.", "CONFLICT");
      }
      const existingSmtpPassword = input.crewProvisioningEmailEnabled && input.smtpUser?.trim()
        ? await secureSettings.get("smtp.password")
        : null;
      validateWelcomeEmailConfiguration({
        enabled: input.crewProvisioningEmailEnabled,
        fromEmail: input.smtpFromEmail,
        host: input.smtpHost,
        port: input.smtpPort,
        username: input.smtpUser,
      }, Boolean(input.smtpPassword?.trim() || existingSmtpPassword));
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
        enableLocalLogin: input.localLoginEnabled,
        crewProvisioningEmailEnabled: input.crewProvisioningEmailEnabled,
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
        if (!currentWebOriginConfig.usingBootstrapFallback) {
          await tx.delete(webOrigins);
          const now = new Date();
          await tx.insert(webOrigins).values(normalizedWebOrigins.map((origin) => ({ origin, enabled: true, createdAt: now, updatedAt: now })));
        }
        await writeAudit(tx, actorUserId, "update", "system_settings", 1, { ...values, web_origins: normalizedWebOrigins, encrypted_settings_changed: secretChanges });
      });
    },
  };
}

async function loadSettings(database: DatabaseConnection, secureStore: SecureSettingsStore): Promise<AdminSettings> {
  const [row, originConfig, oidcSecret, smtpPassword, vegvesenKey, crewToken] = await Promise.all([
    database.db.select().from(systemSettings).where(eq(systemSettings.id, 1)).limit(1).then((rows) => rows[0]),
    loadActiveWebOrigins(database),
    secureStore.get("oidc.client_secret"), secureStore.get("smtp.password"), secureStore.get("vegvesen.api_key"), secureStore.get("crew.api_bearer_token"),
  ]);
  if (!row) throw new AdminDomainError("Systeminnstillinger finnes ikke.", "NOT_FOUND");
  return {
    appName: row.appName?.trim() || "Bifrost", localLoginEnabled: row.enableLocalLogin,
    crewProvisioningEmailEnabled: row.crewProvisioningEmailEnabled,
    webOrigins: originConfig.origins, logoUrl: row.logoUrl, faviconUrl: row.faviconUrl,
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

function mapCrewProvisioningRule(rule: CrewRuleViewRow): CrewProvisioningRule {
  return {
    id: rule.id,
    crewName: rule.crewName,
    crewRole: rule.crewRole,
    roleId: rule.roleId,
    roleName: rule.roleName,
    roleDisplayName: rule.roleDisplayName?.trim() || rule.roleName,
    enabled: rule.enabled,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

async function loadAdminUser(database: DatabaseConnection, userId: number): Promise<AdminUser | null> {
  const [user] = await database.db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;
  const [assignments, competencyRows] = await Promise.all([
    database.db.select({ roleId: roles.id, name: roles.name, displayName: roles.displayName })
      .from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, userId)),
    user.wannabeId
      ? database.db.select().from(wannabeCompetencies).where(eq(wannabeCompetencies.wannabeId, user.wannabeId)).limit(1)
      : Promise.resolve([]),
  ]);
  return mapAdminUser(user, assignments, competencyRows[0]);
}

function normalizeCrewProvisioningRule(input: CrewProvisioningRuleInput) {
  const crewName = plainText(input.crewName, 180);
  if (!crewName) throw new AdminDomainError("Wannabe-crew er påkrevd.", "CONFLICT");
  return {
    crewName,
    crewRole: nullableText(input.crewRole, 180),
    roleId: input.roleId,
    enabled: input.enabled,
  };
}

async function requireRole(tx: DatabaseTransaction, roleId: number): Promise<void> {
  const [role] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role) throw new AdminDomainError("Bifrost-rollen finnes ikke.", "NOT_FOUND");
}

async function requireUniqueCrewRule(
  tx: DatabaseTransaction,
  input: { crewName: string; crewRole: string | null; roleId: number },
  ignoredRuleId?: number,
): Promise<void> {
  const existing = await tx.select({
    id: crewProvisioningRules.id,
    crewName: crewProvisioningRules.crewName,
    crewRole: crewProvisioningRules.crewRole,
    roleId: crewProvisioningRules.roleId,
  }).from(crewProvisioningRules);
  const duplicate = existing.some((rule) =>
    rule.id !== ignoredRuleId
    && normalizedMatchValue(rule.crewName) === normalizedMatchValue(input.crewName)
    && normalizedMatchValue(rule.crewRole ?? "") === normalizedMatchValue(input.crewRole ?? "")
    && rule.roleId === input.roleId,
  );
  if (duplicate) throw new AdminDomainError("Den samme crew- og rollemappingen finnes allerede.", "CONFLICT");
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
function normalizeEmail(value: string): string { const email = value.trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 180) : ""; }
export function validateWelcomeEmailConfiguration(
  input: { enabled: boolean; fromEmail?: string | null; host?: string | null; port?: number | null; username?: string | null },
  hasPassword: boolean,
): void {
  if (!input.enabled) return;
  if (!input.fromEmail?.trim() || !input.host?.trim() || !input.port) {
    throw new AdminDomainError("SMTP-avsender, vert og port må konfigureres før velkomst-e-post kan aktiveres.", "CONFLICT");
  }
  if (input.username?.trim() && !hasPassword) {
    throw new AdminDomainError("Kryptert SMTP-passord må konfigureres når SMTP-brukernavn er satt.", "CONFLICT");
  }
}
function normalizedMatchValue(value: string): string { return value.trim().toLocaleLowerCase("nb-NO").replace(/\s+/g, " "); }
export function crewProvisioningRuleMatches(
  profile: Pick<CrewProfile, "crewName" | "role" | "roleName">,
  rule: { crewName: string; crewRole: string | null },
): boolean {
  if (normalizedMatchValue(profile.crewName) !== normalizedMatchValue(rule.crewName)) return false;
  if (!rule.crewRole) return true;
  const profileRoles = new Set([profile.role, profile.roleName ?? ""].map(normalizedMatchValue).filter(Boolean));
  return profileRoles.has(normalizedMatchValue(rule.crewRole));
}
function splitPersonName(value: string): { firstName: string; lastName: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) ?? "" };
}
function normalizeWebOrigins(values: string[]): string[] {
  const normalized = new Set<string>();
  for (const value of values) {
    try {
      const url = new URL(value.trim());
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
      normalized.add(url.origin);
    } catch {
      throw new AdminDomainError(`Ugyldig Web-origin: ${value}`, "CONFLICT");
    }
  }
  if (normalized.size === 0) throw new AdminDomainError("Minst ett Web-domene må være konfigurert.", "CONFLICT");
  return [...normalized];
}
function normalizeEndpoint(value: string | null | undefined): string { const clean = (value ?? "").trim().replace(/^\/+|\/+$/g, ""); return clean ? `/${clean}/` : "/"; }
async function writeAudit(tx: DatabaseTransaction, actorUserId: number, action: string, entityType: string, entityId: number, diffJson: unknown): Promise<void> {
  await tx.insert(auditLogs).values({ actorUserId, action, entityType, entityId, diffJson, createdAt: new Date() });
}
