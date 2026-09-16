import type { Location } from "@bifrost/contracts";
import { auditLogs, locations, pallets, transportJobs, type DatabaseConnection } from "@bifrost/database";
import { and, asc, count, eq, inArray, ne, notInArray, or } from "drizzle-orm";

const TRANSPORT_ARCHIVE_LOCATION = "Slettet lokasjon (transportarkiv)";
const ACTIVE_TRANSPORT_STATUSES = ["open", "assigned", "in_progress"];

export interface LocationInput {
  name: string;
  type: string;
  address?: string;
}

export class LocationDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT") { super(message); }
}

export interface LocationService {
  list(): Promise<Location[]>;
  create(input: LocationInput, actorUserId: number): Promise<Location>;
  update(id: number, input: LocationInput, actorUserId: number): Promise<void>;
  delete(id: number, actorUserId: number): Promise<void>;
}

export function createLocationService(database: DatabaseConnection): LocationService {
  return {
    async list() {
      return database.db.select({ id: locations.id, name: locations.name, type: locations.type, address: locations.address })
        .from(locations)
        .where(ne(locations.name, TRANSPORT_ARCHIVE_LOCATION))
        .orderBy(asc(locations.name));
    },

    async create(input, actorUserId) {
      return database.db.transaction(async (tx) => {
        const address = input.address || null;
        const [created] = await tx.insert(locations).values({ name: input.name, type: input.type, address }).$returningId();
        if (!created) throw new Error("Lokasjon kunne ikke opprettes.");
        await tx.insert(auditLogs).values({
          actorUserId,
          action: "create",
          entityType: "location",
          entityId: created.id,
          diffJson: { ...input, address },
          createdAt: new Date(),
        });
        return { id: created.id, name: input.name, type: input.type, address };
      });
    },

    async update(id, input, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [location] = await tx.select({ id: locations.id }).from(locations).where(eq(locations.id, id)).limit(1);
        if (!location) throw new LocationDomainError("Lokasjon finnes ikke.", "NOT_FOUND");
        const address = input.address || null;
        await tx.update(locations).set({
          name: input.name,
          type: input.type,
          address,
          latitude: null,
          longitude: null,
        }).where(eq(locations.id, id));
        await tx.insert(auditLogs).values({
          actorUserId,
          action: "update",
          entityType: "location",
          entityId: id,
          diffJson: { ...input, address },
          createdAt: new Date(),
        });
      });
    },

    async delete(id, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [location] = await tx.select({ name: locations.name }).from(locations).where(eq(locations.id, id)).limit(1);
        if (!location) throw new LocationDomainError("Lokasjon finnes ikke.", "NOT_FOUND");
        if (location.name === TRANSPORT_ARCHIVE_LOCATION) {
          throw new LocationDomainError("Arkivlokasjonen for transport kan ikke slettes.", "CONFLICT");
        }

        const [palletUsage] = await tx.select({ value: count() }).from(pallets).where(eq(pallets.locationId, id));
        if ((palletUsage?.value ?? 0) > 0) {
          throw new LocationDomainError("Lokasjon kan ikke slettes fordi den har paller.", "CONFLICT");
        }

        const locationReference = or(eq(transportJobs.fromLocationId, id), eq(transportJobs.toLocationId, id));
        const [activeJobs] = await tx.select({ value: count() }).from(transportJobs)
          .where(and(locationReference, inArray(transportJobs.status, ACTIVE_TRANSPORT_STATUSES)));
        if ((activeJobs?.value ?? 0) > 0) {
          throw new LocationDomainError("Lokasjon kan ikke slettes fordi den brukes i aktive transportoppdrag.", "CONFLICT");
        }

        const [allJobs] = await tx.select({ value: count() }).from(transportJobs).where(locationReference);
        if ((allJobs?.value ?? 0) > 0) {
          let [archive] = await tx.select({ id: locations.id }).from(locations)
            .where(eq(locations.name, TRANSPORT_ARCHIVE_LOCATION)).limit(1);
          if (!archive) {
            [archive] = await tx.insert(locations).values({ name: TRANSPORT_ARCHIVE_LOCATION, type: "Arkiv", address: null }).$returningId();
          }
          if (!archive) throw new Error("Arkivlokasjonen kunne ikke opprettes.");
          await tx.update(transportJobs).set({ fromLocationId: archive.id })
            .where(and(eq(transportJobs.fromLocationId, id), notInArray(transportJobs.status, ACTIVE_TRANSPORT_STATUSES)));
          await tx.update(transportJobs).set({ toLocationId: archive.id })
            .where(and(eq(transportJobs.toLocationId, id), notInArray(transportJobs.status, ACTIVE_TRANSPORT_STATUSES)));
        }

        await tx.delete(locations).where(eq(locations.id, id));
        await tx.insert(auditLogs).values({
          actorUserId,
          action: "delete",
          entityType: "location",
          entityId: id,
          diffJson: { name: location.name },
          createdAt: new Date(),
        });
      });
    },
  };
}
