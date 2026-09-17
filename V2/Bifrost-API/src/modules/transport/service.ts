import type {
  CurrentUser,
  TransportAssignee,
  TransportJob,
  TransportJobKind,
  TransportWorkspaceResponse,
  VehicleCompetencyCode,
  VehicleCompetencyRequirement,
} from "@bifrost/contracts";
import { BIFROST_ACCESS, VEHICLE_COMPETENCY_CODES } from "@bifrost/contracts";
import {
  auditLogs,
  locations,
  transportJobs,
  transportJobStops,
  users,
  vehicleLoans,
  vehicles,
  wannabeCompetencies,
  wannabeVehicleKdo,
  type DatabaseConnection,
} from "@bifrost/database";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { RoutePoint, TransportRouting } from "./routing.js";

export const TRANSPORT_MANAGER_ROLES = BIFROST_ACCESS.transportManager;
export const TRANSPORT_REQUEST_ROLES = BIFROST_ACCESS.transportRequest;
export const TRANSPORT_ACCESS_ROLES = BIFROST_ACCESS.transport;

const ACTIVE_STATUSES = ["open", "assigned", "in_progress"] as const;
const ARCHIVE_LOCATION = "Slettet lokasjon (transportarkiv)";

export interface TransportStopInput {
  address: string;
  notes?: string | null;
}

export interface TransportJobCreateInput {
  description: string;
  fromLocationId: number;
  toLocationId: number;
  vehicleId: number;
  jobKind: Exclude<TransportJobKind, "people">;
  requesterUserId?: number | null;
  requesterWannabeId?: number | null;
  stops: TransportStopInput[];
}

export interface PeopleTransportRequestInput {
  description?: string | null;
  fromLocationId: number;
  toLocationId: number;
  peopleCount: number;
  pickupAt: Date;
}

export interface TransportStartInput {
  vehicleId?: number | null;
  startOdometer?: number | null;
}

export class TransportDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT" | "FORBIDDEN") { super(message); }
}

export interface TransportService {
  workspace(user: CurrentUser): Promise<TransportWorkspaceResponse>;
  inspect(id: number, user: CurrentUser): Promise<TransportJob>;
  create(input: TransportJobCreateInput, actorUserId: number): Promise<{ id: number }>;
  requestPeople(input: PeopleTransportRequestInput, user: CurrentUser): Promise<{ id: number }>;
  assign(id: number, assignedUserId: number, actorUserId: number): Promise<void>;
  start(id: number, input: TransportStartInput, actorUserId: number): Promise<void>;
  complete(id: number, endOdometer: number | null, actorUserId: number): Promise<void>;
}

type JobRow = typeof transportJobs.$inferSelect;
type LocationRow = typeof locations.$inferSelect;
type VehicleRow = typeof vehicles.$inferSelect;
type UserRow = typeof users.$inferSelect;
type StopRow = typeof transportJobStops.$inferSelect;
type DatabaseTransaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];

export function createTransportService(database: DatabaseConnection, routing: TransportRouting): TransportService {
  return {
    async workspace(user) {
      const canManage = hasAnyRole(user, TRANSPORT_MANAGER_ROLES);
      const canRequestPeople = !canManage && hasAnyRole(user, TRANSPORT_REQUEST_ROLES);
      const activeWhere = canManage
        ? inArray(transportJobs.status, [...ACTIVE_STATUSES])
        : and(eq(transportJobs.requesterUserId, user.id), inArray(transportJobs.status, [...ACTIVE_STATUSES]));
      const completedWhere = canManage
        ? eq(transportJobs.status, "completed")
        : and(eq(transportJobs.requesterUserId, user.id), eq(transportJobs.status, "completed"));
      const [activeRows, completedRows] = await Promise.all([
        database.db.select().from(transportJobs).where(activeWhere).orderBy(desc(transportJobs.createdAt)),
        database.db.select().from(transportJobs).where(completedWhere).orderBy(desc(transportJobs.updatedAt)),
      ]);

      await refreshMissingEstimates(database, routing, activeRows);
      const context = await loadContext(database, [...activeRows, ...completedRows], canManage);
      return {
        canManage,
        canRequestPeople,
        locations: context.locationRows.filter((item) => item.name !== ARCHIVE_LOCATION).map(toLocationContract),
        transportLocations: context.locationRows.filter((item) => item.name !== ARCHIVE_LOCATION && item.type.toLocaleLowerCase("nb-NO") === "transport").map(toLocationContract),
        users: canManage ? context.userRows.map(toAssignee) : [],
        vehicles: canManage ? context.vehicleRows.filter((item) => item.status === "available" || item.status === "loaned").map(toVehicleOption) : [],
        activeJobs: activeRows.map((job) => toJobContract(job, context)),
        completedJobs: completedRows.map((job) => toJobContract(job, context)),
      };
    },

    async inspect(id, user) {
      const [job] = await database.db.select().from(transportJobs).where(eq(transportJobs.id, id)).limit(1);
      if (!job) throw new TransportDomainError("Oppdraget finnes ikke.", "NOT_FOUND");
      const canManage = hasAnyRole(user, TRANSPORT_MANAGER_ROLES);
      if (!canManage && job.requesterUserId !== user.id) throw new TransportDomainError("Du har ikke tilgang til oppdraget.", "FORBIDDEN");
      await refreshMissingEstimates(database, routing, [job]);
      const context = await loadContext(database, [job], canManage);
      return toJobContract(job, context);
    },

    async create(input, actorUserId) {
      const description = plainText(input.description, 5000);
      if (!description) throw new TransportDomainError("Beskrivelse er påkrevd.", "CONFLICT");
      if (input.fromLocationId === input.toLocationId && input.jobKind === "equipment") {
        throw new TransportDomainError("Start og slutt kan ikke være samme lokasjon.", "CONFLICT");
      }
      const [fromLocation, toLocation, requestedVehicle] = await Promise.all([
        findLocation(database, input.fromLocationId),
        findLocation(database, input.toLocationId),
        findVehicle(database, input.vehicleId),
      ]);
      validateLocations(input.jobKind, fromLocation, toLocation);
      if (requestedVehicle.status !== "available" && requestedVehicle.status !== "loaned") {
        throw new TransportDomainError("Valgt kjøretøy kan ikke knyttes til et nytt transportoppdrag nå.", "CONFLICT");
      }
      const stops = normalizeStops(input.jobKind, input.stops);
      const estimate = await prepareEstimate(routing, fromLocation, toLocation, stops);

      const id = await database.db.transaction(async (tx) => {
        const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, input.vehicleId)).limit(1).for("update");
        if (!vehicle) throw new TransportDomainError("Valgt kjøretøy finnes ikke.", "NOT_FOUND");
        if (vehicle.status !== "available" && vehicle.status !== "loaned") {
          throw new TransportDomainError("Valgt kjøretøy er allerede reservert eller utilgjengelig.", "CONFLICT");
        }
        const requester = await resolveRequester(tx, input.requesterUserId, input.requesterWannabeId);
        const now = new Date();
        const [created] = await tx.insert(transportJobs).values({
          description,
          fromLocationId: input.fromLocationId,
          toLocationId: input.toLocationId,
          transportType: "equipment",
          jobKind: input.jobKind,
          peopleCount: null,
          pickupAt: null,
          equipmentId: null,
          requesterUserId: requester.userId,
          requesterWannabeId: requester.wannabeId,
          assignedUserId: null,
          assignedVehicleId: input.vehicleId,
          startOdometer: null,
          endOdometer: null,
          distanceKm: null,
          estimatedDistanceKm: estimate.distanceKm,
          distanceDeviationKm: null,
          status: "open",
          createdAt: now,
          updatedAt: now,
        }).$returningId();
        if (!created) throw new Error("Transportoppdraget kunne ikke opprettes.");
        if (stops.length) {
          await tx.insert(transportJobStops).values(stops.map((stop, index) => ({
            transportJobId: created.id,
            stopNumber: index + 1,
            address: stop.address,
            latitude: estimate.stopPoints[index]?.lat?.toString() ?? null,
            longitude: estimate.stopPoints[index]?.lon?.toString() ?? null,
            notes: stop.notes || null,
            createdAt: now,
          })));
        }
        await persistLocationPoint(tx, fromLocation, estimate.fromPoint);
        await persistLocationPoint(tx, toLocation, estimate.toPoint);
        await tx.update(vehicles).set({ status: "reserved_transport", updatedAt: now }).where(eq(vehicles.id, input.vehicleId));
        await writeAudit(tx, actorUserId, "create", "transport_job", created.id, {
          job_kind: input.jobKind,
          vehicle_id: input.vehicleId,
          requester_user_id: requester.userId,
          requester_wannabe_id: requester.wannabeId,
          stops,
          estimated_distance_km: estimate.distanceKm,
        });
        return created.id;
      });
      return { id };
    },

    async requestPeople(input, user) {
      if (!hasAnyRole(user, TRANSPORT_REQUEST_ROLES) || hasAnyRole(user, TRANSPORT_MANAGER_ROLES)) {
        throw new TransportDomainError("Denne rollen kan ikke opprette transportforespørsler.", "FORBIDDEN");
      }
      if (input.fromLocationId === input.toLocationId) throw new TransportDomainError("Fra- og til-lokasjon kan ikke være samme.", "CONFLICT");
      const [fromLocation, toLocation] = await Promise.all([
        findLocation(database, input.fromLocationId),
        findLocation(database, input.toLocationId),
      ]);
      if (fromLocation.type.toLocaleLowerCase("nb-NO") !== "transport" || toLocation.type.toLocaleLowerCase("nb-NO") !== "transport") {
        throw new TransportDomainError("Persontransport må bruke lokasjoner av type Transport.", "CONFLICT");
      }
      const description = plainText(input.description || "Persontransport", 5000) || "Persontransport";
      const id = await database.db.transaction(async (tx) => {
        const now = new Date();
        const [created] = await tx.insert(transportJobs).values({
          description,
          fromLocationId: input.fromLocationId,
          toLocationId: input.toLocationId,
          transportType: "people",
          jobKind: "people",
          peopleCount: input.peopleCount,
          pickupAt: input.pickupAt,
          equipmentId: null,
          requesterUserId: user.id,
          requesterWannabeId: null,
          assignedUserId: null,
          assignedVehicleId: null,
          startOdometer: null,
          endOdometer: null,
          distanceKm: null,
          estimatedDistanceKm: null,
          distanceDeviationKm: null,
          status: "open",
          createdAt: now,
          updatedAt: now,
        }).$returningId();
        if (!created) throw new Error("Transportforespørselen kunne ikke opprettes.");
        await writeAudit(tx, user.id, "create", "transport_request_people", created.id, {
          from_location_id: input.fromLocationId,
          to_location_id: input.toLocationId,
          people_count: input.peopleCount,
          pickup_at: input.pickupAt.toISOString(),
          description,
        });
        return created.id;
      });
      return { id };
    },

    async assign(id, assignedUserId, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [job] = await tx.select().from(transportJobs).where(eq(transportJobs.id, id)).limit(1).for("update");
        if (!job) throw new TransportDomainError("Oppdraget finnes ikke.", "NOT_FOUND");
        if (job.status !== "open") throw new TransportDomainError("Bare åpne oppdrag kan tildeles.", "CONFLICT");
        const [assignee] = await tx.select().from(users).where(eq(users.id, assignedUserId)).limit(1);
        if (!assignee) throw new TransportDomainError("Brukeren finnes ikke.", "NOT_FOUND");
        if (job.assignedVehicleId && !await assigneeCanDrive(tx, assignee, job.assignedVehicleId)) {
          throw new TransportDomainError("Valgt person mangler nødvendig førerkort eller kompetanse for oppdraget.", "CONFLICT");
        }
        const now = new Date();
        await tx.update(transportJobs).set({ assignedUserId, status: "assigned", updatedAt: now }).where(eq(transportJobs.id, id));
        await writeAudit(tx, actorUserId, "assign", "transport_job", id, { assigned_user_id: assignedUserId });
      });
    },

    async start(id, input, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [job] = await tx.select().from(transportJobs).where(eq(transportJobs.id, id)).limit(1).for("update");
        if (!job) throw new TransportDomainError("Oppdraget finnes ikke.", "NOT_FOUND");
        if (job.status !== "assigned" || !job.assignedUserId) throw new TransportDomainError("Oppdraget kan ikke startes fra nåværende status.", "CONFLICT");
        const vehicleId = job.assignedVehicleId ?? input.vehicleId;
        if (!vehicleId) throw new TransportDomainError("Velg kjøretøy før oppdraget startes.", "CONFLICT");
        const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1).for("update");
        if (!vehicle) throw new TransportDomainError("Valgt kjøretøy finnes ikke.", "NOT_FOUND");
        const allowedStatuses = job.assignedVehicleId ? ["available", "reserved_transport"] : ["available"];
        if (!allowedStatuses.includes(vehicle.status)) throw new TransportDomainError("Valgt kjøretøy er ikke tilgjengelig.", "CONFLICT");
        const [assignee] = await tx.select().from(users).where(eq(users.id, job.assignedUserId)).limit(1);
        if (!assignee || !await assigneeCanDrive(tx, assignee, vehicleId)) {
          throw new TransportDomainError("Tildelt person mangler nødvendig førerkort eller kompetanse for kjøretøyet.", "CONFLICT");
        }
        const startOdometer = vehicle.odometerExempt ? null : input.startOdometer;
        if (!vehicle.odometerExempt && startOdometer == null) throw new TransportDomainError("Fyll inn nåværende kilometerstand.", "CONFLICT");
        if (startOdometer != null && startOdometer < Math.max(0, vehicle.currentOdometer ?? 0)) {
          throw new TransportDomainError("Start kilometerstand kan ikke være lavere enn kjøretøyets registrerte kilometerstand.", "CONFLICT");
        }
        const now = new Date();
        await tx.update(transportJobs).set({
          assignedVehicleId: vehicleId,
          startOdometer,
          endOdometer: null,
          distanceKm: null,
          distanceDeviationKm: null,
          status: "in_progress",
          updatedAt: now,
        }).where(eq(transportJobs.id, id));
        await tx.update(vehicles).set({
          status: "in_transport",
          currentOdometer: startOdometer ?? vehicle.currentOdometer,
          updatedAt: now,
        }).where(eq(vehicles.id, vehicleId));
        await writeAudit(tx, actorUserId, "status", "transport_job", id, {
          status: "in_progress", vehicle_id: vehicleId, start_odometer: startOdometer,
        });
      });
    },

    async complete(id, requestedEndOdometer, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [job] = await tx.select().from(transportJobs).where(eq(transportJobs.id, id)).limit(1).for("update");
        if (!job) throw new TransportDomainError("Oppdraget finnes ikke.", "NOT_FOUND");
        if (job.status !== "in_progress" || !job.assignedVehicleId) {
          throw new TransportDomainError("Oppdraget kan ikke fullføres fra nåværende status.", "CONFLICT");
        }
        const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, job.assignedVehicleId)).limit(1).for("update");
        if (!vehicle) throw new TransportDomainError("Valgt kjøretøy finnes ikke.", "NOT_FOUND");
        const endOdometer = vehicle.odometerExempt ? null : requestedEndOdometer;
        if (!vehicle.odometerExempt && endOdometer == null) throw new TransportDomainError("Fyll inn kilometerstand ved parkering.", "CONFLICT");
        const startOdometer = vehicle.odometerExempt ? null : job.startOdometer;
        if (!vehicle.odometerExempt && startOdometer == null) throw new TransportDomainError("Oppdraget mangler kilometerstand ved start.", "CONFLICT");
        if (endOdometer != null && startOdometer != null && endOdometer < startOdometer) {
          throw new TransportDomainError("Kilometerstand ved parkering kan ikke være lavere enn kilometerstand ved start.", "CONFLICT");
        }
        const distanceKm = endOdometer != null && startOdometer != null ? endOdometer - startOdometer : null;
        const deviationKm = distanceKm != null && job.estimatedDistanceKm != null ? distanceKm - job.estimatedDistanceKm : null;
        const [activeLoan] = await tx.select({ id: vehicleLoans.id }).from(vehicleLoans)
          .where(and(eq(vehicleLoans.vehicleId, vehicle.id), eq(vehicleLoans.status, "active"))).limit(1);
        const now = new Date();
        await tx.update(transportJobs).set({
          endOdometer,
          distanceKm,
          distanceDeviationKm: deviationKm,
          status: "completed",
          updatedAt: now,
        }).where(eq(transportJobs.id, id));
        await tx.update(vehicles).set({
          status: activeLoan ? "loaned" : "available",
          currentOdometer: endOdometer ?? vehicle.currentOdometer,
          updatedAt: now,
        }).where(eq(vehicles.id, vehicle.id));
        await writeAudit(tx, actorUserId, "status", "transport_job", id, {
          status: "completed", end_odometer: endOdometer, distance_km: distanceKm, distance_deviation_km: deviationKm,
        });
      });
    },
  };
}

interface Context {
  locationRows: LocationRow[];
  userRows: UserRow[];
  vehicleRows: VehicleRow[];
  locationsById: Map<number, LocationRow>;
  usersById: Map<number, UserRow>;
  vehiclesById: Map<number, VehicleRow>;
  stopsByJobId: Map<number, StopRow[]>;
  eligibleByJobId: Map<number, TransportAssignee[]>;
}

async function loadContext(database: DatabaseConnection, jobs: JobRow[], includeOperationalOptions: boolean): Promise<Context> {
  const [locationRows, userRows, vehicleRows, stopRows, competencyRows, kdoRows] = await Promise.all([
    database.db.select().from(locations).orderBy(asc(locations.name)),
    includeOperationalOptions ? database.db.select().from(users).orderBy(asc(users.name)) : database.db.select().from(users).where(inArray(users.id, ids(jobs.flatMap((job) => [job.requesterUserId, job.assignedUserId])) || [-1])),
    database.db.select().from(vehicles).orderBy(asc(vehicles.name)),
    jobs.length ? database.db.select().from(transportJobStops).where(inArray(transportJobStops.transportJobId, jobs.map((job) => job.id))).orderBy(asc(transportJobStops.stopNumber)) : Promise.resolve([]),
    includeOperationalOptions ? database.db.select().from(wannabeCompetencies) : Promise.resolve([]),
    includeOperationalOptions ? database.db.select().from(wannabeVehicleKdo) : Promise.resolve([]),
  ]);
  const locationsById = new Map(locationRows.map((item) => [item.id, item]));
  const usersById = new Map(userRows.map((item) => [item.id, item]));
  const vehiclesById = new Map(vehicleRows.map((item) => [item.id, item]));
  const stopsByJobId = new Map<number, StopRow[]>();
  for (const stop of stopRows) stopsByJobId.set(stop.transportJobId, [...(stopsByJobId.get(stop.transportJobId) ?? []), stop]);
  const competenciesByWannabe = new Map(competencyRows.map((item) => [item.wannabeId, competencyRecord(item)]));
  const kdoKeys = new Set(kdoRows.map((item) => `${item.wannabeId}:${item.vehicleId}`));
  const eligibleByJobId = new Map<number, TransportAssignee[]>();
  if (includeOperationalOptions) {
    for (const job of jobs) {
      const vehicle = job.assignedVehicleId ? vehiclesById.get(job.assignedVehicleId) : undefined;
      eligibleByJobId.set(job.id, userRows.filter((user) => userCanHandleVehicle(
        user,
        vehicle,
        user.wannabeId ? competenciesByWannabe.get(user.wannabeId) : undefined,
        Boolean(user.wannabeId && vehicle && kdoKeys.has(`${user.wannabeId}:${vehicle.id}`)),
      )).map(toAssignee));
    }
  }
  return { locationRows, userRows, vehicleRows, locationsById, usersById, vehiclesById, stopsByJobId, eligibleByJobId };
}

function toJobContract(job: JobRow, context: Context): TransportJob {
  const from = context.locationsById.get(job.fromLocationId);
  const to = context.locationsById.get(job.toLocationId);
  const requester = job.requesterUserId ? context.usersById.get(job.requesterUserId) : undefined;
  const assignee = job.assignedUserId ? context.usersById.get(job.assignedUserId) : undefined;
  const vehicle = job.assignedVehicleId ? context.vehiclesById.get(job.assignedVehicleId) : undefined;
  return {
    id: job.id,
    description: job.description,
    transportType: job.transportType === "people" ? "people" : "equipment",
    jobKind: normalizeJobKind(job.jobKind ?? job.transportType),
    peopleCount: job.peopleCount,
    pickupAt: job.pickupAt?.toISOString() ?? null,
    fromLocationId: job.fromLocationId,
    fromName: from?.name === ARCHIVE_LOCATION ? null : from?.name ?? null,
    fromType: from?.type ?? "",
    fromAddress: from?.address ?? null,
    toLocationId: job.toLocationId,
    toName: to?.name === ARCHIVE_LOCATION ? null : to?.name ?? null,
    toType: to?.type ?? "",
    toAddress: to?.address ?? null,
    requesterUserId: job.requesterUserId,
    requesterWannabeId: job.requesterWannabeId,
    requesterName: requester?.name ?? null,
    assignedUserId: job.assignedUserId,
    assignedName: assignee?.name ?? null,
    assignedVehicleId: job.assignedVehicleId,
    vehicleName: vehicle?.name ?? null,
    vehicleRegistrationNumber: vehicle?.registrationNumber ?? null,
    vehicleOdometerExempt: vehicle?.odometerExempt ?? null,
    vehicleCurrentOdometer: vehicle?.currentOdometer ?? null,
    startOdometer: job.startOdometer,
    endOdometer: job.endOdometer,
    distanceKm: job.distanceKm,
    estimatedDistanceKm: job.estimatedDistanceKm,
    distanceDeviationKm: job.distanceDeviationKm,
    status: normalizeStatus(job.status),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    stops: (context.stopsByJobId.get(job.id) ?? []).map((stop) => ({
      id: stop.id,
      stopNumber: stop.stopNumber,
      address: stop.address,
      latitude: decimalNumber(stop.latitude),
      longitude: decimalNumber(stop.longitude),
      notes: stop.notes,
    })),
    eligibleAssignees: context.eligibleByJobId.get(job.id) ?? [],
  };
}

function toLocationContract(location: LocationRow) {
  return { id: location.id, name: location.name, type: location.type, address: location.address };
}

function toAssignee(user: UserRow): TransportAssignee {
  return { id: user.id, name: user.name, wannabeId: user.wannabeId };
}

function toVehicleOption(vehicle: VehicleRow) {
  return {
    id: vehicle.id,
    name: vehicle.name,
    registrationNumber: vehicle.registrationNumber,
    status: vehicle.status,
    currentOdometer: vehicle.currentOdometer,
    odometerExempt: vehicle.odometerExempt,
  };
}

async function findLocation(database: DatabaseConnection, id: number): Promise<LocationRow> {
  const [location] = await database.db.select().from(locations).where(eq(locations.id, id)).limit(1);
  if (!location) throw new TransportDomainError("Valgt lokasjon finnes ikke.", "NOT_FOUND");
  return location;
}

async function findVehicle(database: DatabaseConnection, id: number): Promise<VehicleRow> {
  const [vehicle] = await database.db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  if (!vehicle) throw new TransportDomainError("Valgt kjøretøy finnes ikke.", "NOT_FOUND");
  return vehicle;
}

function validateLocations(jobKind: Exclude<TransportJobKind, "people">, from: LocationRow, to: LocationRow): void {
  const fromType = from.type.toLocaleLowerCase("nb-NO");
  const toType = to.type.toLocaleLowerCase("nb-NO");
  if (jobKind === "equipment" && (fromType === "transport" || toType === "transport")) {
    throw new TransportDomainError("Utstyrstransport kan ikke bruke lokasjoner av type Transport.", "CONFLICT");
  }
  if ((jobKind === "innkjopsrunde" || jobKind === "henterunde") && (!["transport", "lager"].includes(fromType) || !["transport", "lager"].includes(toType))) {
    throw new TransportDomainError("Innkjøpsrunde og henterunde må bruke start/slutt-lokasjoner av type Transport eller Lager.", "CONFLICT");
  }
}

function normalizeStops(jobKind: Exclude<TransportJobKind, "people">, rawStops: TransportStopInput[]): Array<{ address: string; notes: string }> {
  if (jobKind === "equipment") return [];
  const stops = rawStops.map((stop) => ({ address: plainText(stop.address, 255), notes: plainText(stop.notes ?? "", 4000) })).filter((stop) => stop.address);
  if (!stops.length) throw new TransportDomainError("Legg inn minst ett stopp med adresse for innkjøpsrunde eller henterunde.", "CONFLICT");
  return stops;
}

async function resolveRequester(tx: DatabaseTransaction, requestedUserId?: number | null, requestedWannabeId?: number | null): Promise<{ userId: number | null; wannabeId: number | null }> {
  let userId = requestedUserId && requestedUserId > 0 ? requestedUserId : null;
  let wannabeId = requestedWannabeId && requestedWannabeId > 0 ? requestedWannabeId : null;
  if (!userId && !wannabeId) throw new TransportDomainError("Velg registrert bruker eller skriv inn en Wannabe-ID.", "CONFLICT");
  if (userId) {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new TransportDomainError("Valgt bruker finnes ikke.", "NOT_FOUND");
    if (user.wannabeId) wannabeId = user.wannabeId;
  } else if (wannabeId) {
    const [user] = await tx.select().from(users).where(eq(users.wannabeId, wannabeId)).limit(1);
    if (user) { userId = user.id; wannabeId = user.wannabeId; }
  }
  return { userId, wannabeId };
}

async function assigneeCanDrive(tx: DatabaseTransaction, user: UserRow, vehicleId: number): Promise<boolean> {
  const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  if (!vehicle) return false;
  if (!user.wannabeId) return normalizeRequirement(vehicle.competencyRequirement) === "none";
  const [profile] = await tx.select().from(wannabeCompetencies).where(eq(wannabeCompetencies.wannabeId, user.wannabeId)).limit(1);
  const [kdo] = await tx.select({ id: wannabeVehicleKdo.id }).from(wannabeVehicleKdo)
    .where(and(eq(wannabeVehicleKdo.wannabeId, user.wannabeId), eq(wannabeVehicleKdo.vehicleId, vehicleId))).limit(1);
  return userCanHandleVehicle(user, vehicle, competencyRecord(profile), Boolean(kdo));
}

export function userCanHandleVehicle(
  user: Pick<UserRow, "wannabeId">,
  vehicle?: Pick<VehicleRow, "competencyRequirement" | "competencyOverrideRequirement">,
  competencies?: Record<VehicleCompetencyCode, boolean>,
  hasVehicleKdo = false,
): boolean {
  if (!vehicle) return true;
  const requirement = normalizeRequirement(vehicle.competencyRequirement);
  if (requirement === "none") return true;
  if (!user.wannabeId) return false;
  if (requirement === "kdo") {
    const override = normalizeCompetency(vehicle.competencyOverrideRequirement);
    return hasVehicleKdo || Boolean(override && competencies?.[override]);
  }
  return Boolean(competencies?.[requirement]);
}

interface PreparedEstimate {
  fromPoint: RoutePoint | null;
  toPoint: RoutePoint | null;
  stopPoints: Array<RoutePoint | null>;
  distanceKm: number | null;
}

async function prepareEstimate(
  routing: TransportRouting,
  from: LocationRow,
  to: LocationRow,
  stops: Array<{ address: string }>,
): Promise<PreparedEstimate> {
  const fromPoint = await resolveLocationPoint(routing, from);
  const stopPoints: Array<RoutePoint | null> = [];
  for (const stop of stops) stopPoints.push(await routing.geocode(stop.address));
  const toPoint = await resolveLocationPoint(routing, to);
  const points = [fromPoint, ...stopPoints, toPoint].filter((point): point is RoutePoint => point !== null);
  return { fromPoint, toPoint, stopPoints, distanceKm: points.length >= 2 ? await routing.distanceKm(points) : null };
}

async function resolveLocationPoint(routing: TransportRouting, location: LocationRow): Promise<RoutePoint | null> {
  const lat = decimalNumber(location.latitude);
  const lon = decimalNumber(location.longitude);
  if (lat !== null && lon !== null) return { lat, lon };
  return location.address?.trim() ? routing.geocode(location.address) : null;
}

async function persistLocationPoint(tx: DatabaseTransaction, location: LocationRow, point: RoutePoint | null): Promise<void> {
  if (!point || (location.latitude !== null && location.longitude !== null)) return;
  await tx.update(locations).set({ latitude: point.lat.toString(), longitude: point.lon.toString() }).where(eq(locations.id, location.id));
}

async function refreshMissingEstimates(database: DatabaseConnection, routing: TransportRouting, jobs: JobRow[]): Promise<void> {
  for (const job of jobs) {
    if (job.estimatedDistanceKm !== null || normalizeJobKind(job.jobKind ?? job.transportType) === "people") continue;
    const [from, to, stops] = await Promise.all([
      findLocation(database, job.fromLocationId),
      findLocation(database, job.toLocationId),
      database.db.select().from(transportJobStops).where(eq(transportJobStops.transportJobId, job.id)).orderBy(asc(transportJobStops.stopNumber)),
    ]);
    const estimate = await prepareEstimate(routing, from, to, stops);
    if (estimate.distanceKm === null) continue;
    await database.db.transaction(async (tx) => {
      await tx.update(transportJobs).set({ estimatedDistanceKm: estimate.distanceKm, updatedAt: new Date() }).where(eq(transportJobs.id, job.id));
      await persistLocationPoint(tx, from, estimate.fromPoint);
      await persistLocationPoint(tx, to, estimate.toPoint);
      for (const [index, stop] of stops.entries()) {
        const point = estimate.stopPoints[index];
        if (point) await tx.update(transportJobStops).set({ latitude: point.lat.toString(), longitude: point.lon.toString() }).where(eq(transportJobStops.id, stop.id));
      }
    });
    job.estimatedDistanceKm = estimate.distanceKm;
  }
}

function competencyRecord(profile?: Partial<Record<VehicleCompetencyCode, boolean>>): Record<VehicleCompetencyCode, boolean> {
  return Object.fromEntries(VEHICLE_COMPETENCY_CODES.map((code) => [code, Boolean(profile?.[code])])) as Record<VehicleCompetencyCode, boolean>;
}

function normalizeRequirement(value: string): VehicleCompetencyRequirement {
  const normalized = value.trim().toLowerCase();
  if (normalized === "none" || normalized === "kdo" || (VEHICLE_COMPETENCY_CODES as readonly string[]).includes(normalized)) return normalized as VehicleCompetencyRequirement;
  return "none";
}

function normalizeCompetency(value: string | null): VehicleCompetencyCode | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return (VEHICLE_COMPETENCY_CODES as readonly string[]).includes(normalized) ? normalized as VehicleCompetencyCode : null;
}

function normalizeJobKind(value: string): TransportJobKind {
  return value === "people" || value === "innkjopsrunde" || value === "henterunde" ? value : "equipment";
}

function normalizeStatus(value: string): TransportJob["status"] {
  return value === "assigned" || value === "in_progress" || value === "completed" ? value : "open";
}

function decimalNumber(value: string | null): number | null {
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ids(values: Array<number | null>): number[] | null {
  const result = [...new Set(values.filter((value): value is number => value !== null))];
  return result.length ? result : null;
}

function hasAnyRole(user: CurrentUser, allowed: ReadonlySet<string>): boolean {
  return user.roles.some((role) => allowed.has(role));
}

function plainText(value: string, maxLength: number): string {
  return value.replace(/<[^>]*>/g, "").trim().slice(0, maxLength);
}

async function writeAudit(tx: DatabaseTransaction, actorUserId: number, action: string, entityType: string, entityId: number, diffJson: Record<string, unknown>): Promise<void> {
  await tx.insert(auditLogs).values({ actorUserId, action, entityType, entityId, diffJson, createdAt: new Date() });
}
