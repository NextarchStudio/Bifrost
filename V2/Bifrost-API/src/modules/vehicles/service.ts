import type {
  CurrentUser,
  VehicleCompetencyCode,
  VehicleCompetencyProfile,
  VehicleCompetencyRequirement,
  VehicleLoanIssueResponse,
  VehicleWorkspaceResponse,
} from "@bifrost/contracts";
import { BIFROST_ACCESS, VEHICLE_COMPETENCY_CODES } from "@bifrost/contracts";
import {
  auditLogs,
  crewDirectoryCache,
  users,
  vehicleLoans,
  vehicles,
  wannabeCompetencies,
  wannabeVehicleKdo,
  type DatabaseConnection,
} from "@bifrost/database";
import { and, asc, eq, ne } from "drizzle-orm";
import type { VehiclePayloadProvider } from "./vegvesen.js";

export const VEHICLE_ROLES = BIFROST_ACCESS.vehicle;
export const VEHICLE_EDIT_ROLES = BIFROST_ACCESS.vehicleEdit;
export const VEHICLE_COMPETENCY_ADMIN_ROLES = BIFROST_ACCESS.vehicleCompetencyAdmin;

export interface VehicleCreateInput {
  name: string;
  registrationNumber: string;
  competencyRequirement: VehicleCompetencyRequirement;
  competencyOverrideRequirement?: VehicleCompetencyCode | null;
  odometerMode: "tracked" | "exempt";
  currentOdometer?: number | null;
  vegvesenExempt: boolean;
  notes?: string | null;
}

export interface VehicleUpdateInput {
  name: string;
  registrationNumber: string;
  competencyRequirement: VehicleCompetencyRequirement;
  competencyOverrideRequirement?: VehicleCompetencyCode | null;
  vegvesenExempt: boolean;
}

export interface VehicleIssueInput {
  vehicleId: number;
  wannabeId: number;
  competencyConfirmed: boolean;
  competencies: Array<VehicleCompetencyCode | "kdo">;
}

export class VehicleDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT" | "COMPETENCY_CONFIRMATION_REQUIRED") { super(message); }
}

export interface VehicleService {
  workspace(user: CurrentUser): Promise<VehicleWorkspaceResponse>;
  competencyProfile(wannabeId: number, vehicleId?: number): Promise<VehicleCompetencyProfile>;
  saveCompetencyProfile(wannabeId: number, competencies: VehicleCompetencyCode[], actorUserId: number): Promise<void>;
  create(input: VehicleCreateInput, actorUserId: number): Promise<{ id: number }>;
  update(id: number, input: VehicleUpdateInput, actorUserId: number): Promise<void>;
  delete(id: number, actorUserId: number): Promise<void>;
  issue(input: VehicleIssueInput, actorUserId: number): Promise<VehicleLoanIssueResponse>;
  returnLoan(id: number, actorUserId: number): Promise<void>;
}

export function createVehicleService(database: DatabaseConnection, payloadProvider?: VehiclePayloadProvider): VehicleService {
  return {
    async workspace(user) {
      const rows = await database.db.select({
        id: vehicles.id,
        name: vehicles.name,
        registrationNumber: vehicles.registrationNumber,
        competencyRequirement: vehicles.competencyRequirement,
        competencyOverrideRequirement: vehicles.competencyOverrideRequirement,
        currentOdometer: vehicles.currentOdometer,
        odometerExempt: vehicles.odometerExempt,
        vegvesenExempt: vehicles.vegvesenExempt,
        maxPayloadKg: vehicles.maxPayloadKg,
        vegvesenLastSyncAt: vehicles.vegvesenLastSyncAt,
        status: vehicles.status,
        notes: vehicles.notes,
        activeLoanId: vehicleLoans.id,
        activeWannabeId: vehicleLoans.wannabeId,
        activeIssuedAt: vehicleLoans.issuedAt,
        userName: users.name,
        cachedName: crewDirectoryCache.name,
      }).from(vehicles)
        .leftJoin(vehicleLoans, and(eq(vehicleLoans.vehicleId, vehicles.id), eq(vehicleLoans.status, "active")))
        .leftJoin(users, eq(users.wannabeId, vehicleLoans.wannabeId))
        .leftJoin(crewDirectoryCache, eq(crewDirectoryCache.wannabeId, vehicleLoans.wannabeId))
        .orderBy(asc(vehicles.name));

      for (const row of rows) {
        const synchronized = await synchronizePayload(database, payloadProvider, {
          id: row.id,
          registrationNumber: row.registrationNumber,
          vegvesenExempt: row.vegvesenExempt,
          maxPayloadKg: row.maxPayloadKg,
          vegvesenLastSyncAt: row.vegvesenLastSyncAt,
        });
        row.maxPayloadKg = synchronized.maxPayloadKg;
        row.vegvesenLastSyncAt = synchronized.vegvesenLastSyncAt;
      }

      return {
        canCreate: hasAnyRole(user, VEHICLE_ROLES),
        canEdit: hasAnyRole(user, VEHICLE_EDIT_ROLES),
        canManageLoans: hasAnyRole(user, VEHICLE_ROLES),
        canManageCompetencies: hasAnyRole(user, VEHICLE_COMPETENCY_ADMIN_ROLES),
        vehicles: rows.map((row) => ({
          id: row.id,
          name: row.name,
          registrationNumber: row.registrationNumber,
          competencyRequirement: normalizeRequirement(row.competencyRequirement),
          competencyOverrideRequirement: normalizeCompetencyCode(row.competencyOverrideRequirement),
          currentOdometer: row.currentOdometer,
          odometerExempt: row.odometerExempt,
          vegvesenExempt: row.vegvesenExempt,
          maxPayloadKg: row.maxPayloadKg,
          vegvesenLastSyncAt: row.vegvesenLastSyncAt?.toISOString() ?? null,
          status: row.status,
          notes: row.notes,
          activeLoanId: row.activeLoanId,
          activeWannabeId: row.activeWannabeId,
          activeBorrowerName: row.userName?.trim() || row.cachedName?.trim() || null,
          activeIssuedAt: row.activeIssuedAt?.toISOString() ?? null,
        })),
      };
    },

    async competencyProfile(wannabeId, vehicleId) {
      const [profile] = await database.db.select().from(wannabeCompetencies)
        .where(eq(wannabeCompetencies.wannabeId, wannabeId)).limit(1);
      let kdoForVehicle = false;
      if (vehicleId) {
        const [record] = await database.db.select({ id: wannabeVehicleKdo.id }).from(wannabeVehicleKdo)
          .where(and(eq(wannabeVehicleKdo.wannabeId, wannabeId), eq(wannabeVehicleKdo.vehicleId, vehicleId))).limit(1);
        kdoForVehicle = Boolean(record);
      }
      return { wannabeId, competencies: competencyRecord(profile), kdoForVehicle };
    },

    async saveCompetencyProfile(wannabeId, selected, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [target] = await tx.select({ id: users.id }).from(users).where(eq(users.wannabeId, wannabeId)).limit(1).for("update");
        if (!target) throw new VehicleDomainError("Brukeren finnes ikke eller mangler Wannabe-ID.", "NOT_FOUND");
        const values = competencyValues(selected);
        await upsertCompetencies(tx, wannabeId, values);
        await writeAudit(tx, actorUserId, "update_competencies", "user", target.id, { wannabe_id: wannabeId, competencies: selected });
      });
    },

    async create(input, actorUserId) {
      const normalizedRegistration = normalizeRegistration(input.registrationNumber);
      if (input.odometerMode === "tracked" && input.currentOdometer == null) {
        throw new VehicleDomainError("Fyll inn kilometerstand eller velg unntatt.", "CONFLICT");
      }
      const requirement = normalizeRequirement(input.competencyRequirement);
      const createdId = await database.db.transaction(async (tx) => {
        const [duplicate] = await tx.select({ id: vehicles.id }).from(vehicles)
          .where(eq(vehicles.registrationNumber, normalizedRegistration)).limit(1);
        if (duplicate) throw new VehicleDomainError("Registreringsnummeret finnes allerede.", "CONFLICT");
        const now = new Date();
        const [created] = await tx.insert(vehicles).values({
          name: plainText(input.name, 150),
          registrationNumber: normalizedRegistration,
          competencyRequirement: requirement,
          competencyOverrideRequirement: requirement === "kdo" ? input.competencyOverrideRequirement ?? null : null,
          currentOdometer: input.odometerMode === "exempt" ? null : input.currentOdometer ?? 0,
          odometerExempt: input.odometerMode === "exempt",
          vegvesenExempt: input.vegvesenExempt,
          maxPayloadKg: null,
          vegvesenLastSyncAt: null,
          status: "available",
          notes: input.notes ? plainText(input.notes, 4000) || null : null,
          createdAt: now,
          updatedAt: now,
        }).$returningId();
        if (!created) throw new Error("Kjøretøyet kunne ikke opprettes.");
        await writeAudit(tx, actorUserId, "create", "vehicle", created.id, { ...input, registrationNumber: normalizedRegistration });
        return created.id;
      });
      await synchronizePayload(database, payloadProvider, {
        id: createdId,
        registrationNumber: normalizedRegistration,
        vegvesenExempt: input.vegvesenExempt,
        maxPayloadKg: null,
        vegvesenLastSyncAt: null,
      }, true);
      return { id: createdId };
    },

    async update(id, input, actorUserId) {
      const normalizedRegistration = normalizeRegistration(input.registrationNumber);
      const requirement = normalizeRequirement(input.competencyRequirement);
      const current = await database.db.transaction(async (tx) => {
        const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, id)).limit(1).for("update");
        if (!vehicle) throw new VehicleDomainError("Kjøretøy finnes ikke.", "NOT_FOUND");
        const [duplicate] = await tx.select({ id: vehicles.id }).from(vehicles)
          .where(and(eq(vehicles.registrationNumber, normalizedRegistration), ne(vehicles.id, id))).limit(1);
        if (duplicate) throw new VehicleDomainError("Registreringsnummeret finnes allerede.", "CONFLICT");
        const now = new Date();
        await tx.update(vehicles).set({
          name: plainText(input.name, 150),
          registrationNumber: normalizedRegistration,
          competencyRequirement: requirement,
          competencyOverrideRequirement: requirement === "kdo" ? input.competencyOverrideRequirement ?? null : null,
          vegvesenExempt: input.vegvesenExempt,
          maxPayloadKg: input.vegvesenExempt ? null : vehicle.maxPayloadKg,
          vegvesenLastSyncAt: input.vegvesenExempt ? null : vehicle.vegvesenLastSyncAt,
          updatedAt: now,
        }).where(eq(vehicles.id, id));
        await writeAudit(tx, actorUserId, "update", "vehicle", id, { ...input });
        return { ...vehicle, registrationNumber: normalizedRegistration, vegvesenExempt: input.vegvesenExempt };
      });
      await synchronizePayload(database, payloadProvider, current, true);
    },

    async delete(id, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [vehicle] = await tx.select({ id: vehicles.id, name: vehicles.name }).from(vehicles)
          .where(eq(vehicles.id, id)).limit(1).for("update");
        if (!vehicle) throw new VehicleDomainError("Kjøretøy finnes ikke.", "NOT_FOUND");
        const [activeLoan] = await tx.select({ id: vehicleLoans.id }).from(vehicleLoans)
          .where(and(eq(vehicleLoans.vehicleId, id), eq(vehicleLoans.status, "active"))).limit(1);
        if (activeLoan) throw new VehicleDomainError("Kjøretøy kan ikke slettes mens det er utlånt.", "CONFLICT");
        await tx.delete(vehicles).where(eq(vehicles.id, id));
        await writeAudit(tx, actorUserId, "delete", "vehicle", id, { name: vehicle.name });
      });
    },

    async issue(input, actorUserId) {
      return database.db.transaction(async (tx) => {
        const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, input.vehicleId)).limit(1).for("update");
        if (!vehicle) throw new VehicleDomainError("Kjøretøy finnes ikke.", "NOT_FOUND");
        const [activeLoan] = await tx.select({ id: vehicleLoans.id }).from(vehicleLoans)
          .where(and(eq(vehicleLoans.vehicleId, input.vehicleId), eq(vehicleLoans.status, "active"))).limit(1);
        if (vehicle.status !== "available" || activeLoan) {
          throw new VehicleDomainError("Kjøretøyet er allerede utlånt eller utilgjengelig.", "CONFLICT");
        }

        const [stored] = await tx.select().from(wannabeCompetencies)
          .where(eq(wannabeCompetencies.wannabeId, input.wannabeId)).limit(1).for("update");
        const storedCompetencies = competencyRecord(stored);
        const requirement = normalizeRequirement(vehicle.competencyRequirement);
        const override = normalizeCompetencyCode(vehicle.competencyOverrideRequirement);

        if (requirement === "kdo" && !(override && storedCompetencies[override])) {
          const [kdo] = await tx.select({ id: wannabeVehicleKdo.id }).from(wannabeVehicleKdo)
            .where(and(eq(wannabeVehicleKdo.wannabeId, input.wannabeId), eq(wannabeVehicleKdo.vehicleId, input.vehicleId))).limit(1);
          if (!kdo) {
            if (!input.competencyConfirmed || !input.competencies.includes("kdo")) {
              throw new VehicleDomainError("Dokumentert opplæring må bekreftes før utlån.", "COMPETENCY_CONFIRMATION_REQUIRED");
            }
            const now = new Date();
            await tx.insert(wannabeVehicleKdo).values({ wannabeId: input.wannabeId, vehicleId: input.vehicleId, createdAt: now, updatedAt: now })
              .onDuplicateKeyUpdate({ set: { updatedAt: now } });
          }
        } else if (requirement !== "none" && requirement !== "kdo" && !storedCompetencies[requirement]) {
          if (!input.competencyConfirmed || !input.competencies.includes(requirement)) {
            throw new VehicleDomainError("Det påkrevde sertifikatet eller beviset må bekreftes før utlån.", "COMPETENCY_CONFIRMATION_REQUIRED");
          }
          const merged = { ...storedCompetencies };
          for (const code of input.competencies) if (code !== "kdo") merged[code] = true;
          await upsertCompetencies(tx, input.wannabeId, merged);
        }

        const now = new Date();
        const [created] = await tx.insert(vehicleLoans).values({
          vehicleId: input.vehicleId,
          wannabeId: input.wannabeId,
          issuedByUserId: actorUserId,
          issuedAt: now,
          returnedAt: null,
          status: "active",
        }).$returningId();
        if (!created) throw new Error("Kjøretøylånet kunne ikke opprettes.");
        await tx.update(vehicles).set({ status: "loaned", updatedAt: now }).where(eq(vehicles.id, input.vehicleId));
        await writeAudit(tx, actorUserId, "issue", "vehicle_loan", created.id, { vehicle_id: input.vehicleId, wannabe_id: input.wannabeId });
        return { loanId: created.id };
      });
    },

    async returnLoan(id, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [loan] = await tx.select().from(vehicleLoans).where(eq(vehicleLoans.id, id)).limit(1).for("update");
        if (!loan || loan.status !== "active") throw new VehicleDomainError("Aktivt kjøretøylån ble ikke funnet.", "NOT_FOUND");
        const now = new Date();
        await tx.update(vehicleLoans).set({ status: "returned", returnedAt: now }).where(eq(vehicleLoans.id, id));
        await tx.update(vehicles).set({ status: "available", updatedAt: now }).where(eq(vehicles.id, loan.vehicleId));
        await writeAudit(tx, actorUserId, "return", "vehicle_loan", id, {});
      });
    },
  };
}

export function competencyRequirementSatisfied(
  requirement: VehicleCompetencyRequirement,
  override: VehicleCompetencyCode | null,
  profile: VehicleCompetencyProfile,
): boolean {
  if (requirement === "none") return true;
  if (requirement === "kdo") return profile.kdoForVehicle || Boolean(override && profile.competencies[override]);
  return profile.competencies[requirement];
}

function hasAnyRole(user: CurrentUser, allowed: ReadonlySet<string>): boolean {
  return user.roles.some((role) => allowed.has(role));
}

function normalizeRegistration(value: string): string {
  return plainText(value, 20).toUpperCase();
}

function normalizeRequirement(value: string): VehicleCompetencyRequirement {
  const normalized = value.trim().toLowerCase();
  if (normalized === "none" || normalized === "kdo" || isCompetencyCode(normalized)) return normalized;
  return "none";
}

function normalizeCompetencyCode(value: string | null | undefined): VehicleCompetencyCode | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return isCompetencyCode(normalized) ? normalized : null;
}

function isCompetencyCode(value: string): value is VehicleCompetencyCode {
  return (VEHICLE_COMPETENCY_CODES as readonly string[]).includes(value);
}

function competencyRecord(profile?: Partial<Record<VehicleCompetencyCode, boolean>>): Record<VehicleCompetencyCode, boolean> {
  return Object.fromEntries(VEHICLE_COMPETENCY_CODES.map((code) => [code, Boolean(profile?.[code])])) as Record<VehicleCompetencyCode, boolean>;
}

function competencyValues(selected: VehicleCompetencyCode[]): Record<VehicleCompetencyCode, boolean> {
  const selectedSet = new Set(selected);
  return Object.fromEntries(VEHICLE_COMPETENCY_CODES.map((code) => [code, selectedSet.has(code)])) as Record<VehicleCompetencyCode, boolean>;
}

type DatabaseTransaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];

async function upsertCompetencies(tx: DatabaseTransaction, wannabeId: number, values: Record<VehicleCompetencyCode, boolean>): Promise<void> {
  const now = new Date();
  await tx.insert(wannabeCompetencies).values({ wannabeId, ...values, kdo: false, createdAt: now, updatedAt: now })
    .onDuplicateKeyUpdate({ set: { ...values, kdo: false, updatedAt: now } });
}

function plainText(value: string, maxLength: number): string {
  return value.replace(/<[^>]*>/g, "").trim().slice(0, maxLength);
}

async function writeAudit(
  tx: DatabaseTransaction,
  actorUserId: number,
  action: string,
  entityType: string,
  entityId: number,
  diffJson: Record<string, unknown>,
): Promise<void> {
  await tx.insert(auditLogs).values({ actorUserId, action, entityType, entityId, diffJson, createdAt: new Date() });
}

async function synchronizePayload(
  database: DatabaseConnection,
  provider: VehiclePayloadProvider | undefined,
  vehicle: { id: number; registrationNumber: string; vegvesenExempt: boolean; maxPayloadKg: number | null; vegvesenLastSyncAt: Date | null },
  force = false,
): Promise<{ maxPayloadKg: number | null; vegvesenLastSyncAt: Date | null }> {
  if (vehicle.vegvesenExempt) {
    if (vehicle.maxPayloadKg !== null || vehicle.vegvesenLastSyncAt !== null) {
      await database.db.update(vehicles).set({ maxPayloadKg: null, vegvesenLastSyncAt: null }).where(eq(vehicles.id, vehicle.id));
    }
    return { maxPayloadKg: null, vegvesenLastSyncAt: null };
  }
  if (!provider || (!force && vehicle.maxPayloadKg !== null)) {
    return { maxPayloadKg: vehicle.maxPayloadKg, vegvesenLastSyncAt: vehicle.vegvesenLastSyncAt };
  }
  const result = await provider.fetchMaxPayloadKg(vehicle.registrationNumber);
  if (!result.success) return { maxPayloadKg: vehicle.maxPayloadKg, vegvesenLastSyncAt: vehicle.vegvesenLastSyncAt };
  const synchronizedAt = new Date();
  await database.db.update(vehicles).set({ maxPayloadKg: result.maxPayloadKg, vegvesenLastSyncAt: synchronizedAt }).where(eq(vehicles.id, vehicle.id));
  return { maxPayloadKg: result.maxPayloadKg, vegvesenLastSyncAt: synchronizedAt };
}
