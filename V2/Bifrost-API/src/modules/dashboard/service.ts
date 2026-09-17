import type { DashboardSummary, GlobalSearchResponse } from "@bifrost/contracts";
import {
  commsLoanItems,
  commsLoans,
  equipment,
  equipmentLoans,
  locations,
  pallets,
  palletSlots,
  transportJobs,
  vehicleLoans,
  type DatabaseConnection,
} from "@bifrost/database";
import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm";

const TRANSPORT_ARCHIVE_LOCATION = "Slettet lokasjon (transportarkiv)";

export interface DashboardService {
  summary(): Promise<DashboardSummary>;
  search(term: string): Promise<GlobalSearchResponse>;
}

export function createDashboardService(database: DatabaseConnection): DashboardService {
  return {
    async summary() {
      const [equipmentLoanRows, commsLoanRows, vehicleLoanRows, distanceRows, transportRows, locationRows] = await Promise.all([
        database.db.select({ total: sql<number>`coalesce(sum(${equipmentLoans.quantity}), 0)` }).from(equipmentLoans).where(eq(equipmentLoans.status, "active")),
        database.db.select({ total: sql<number>`coalesce(sum(${commsLoanItems.quantity}), 0)` }).from(commsLoanItems)
          .innerJoin(commsLoans, eq(commsLoans.id, commsLoanItems.loanId)).where(eq(commsLoans.status, "active")),
        database.db.select({ total: sql<number>`count(*)` }).from(vehicleLoans).where(eq(vehicleLoans.status, "active")),
        database.db.select({ total: sql<number>`coalesce(sum(${transportJobs.distanceKm}), 0)` }).from(transportJobs),
        database.db.select({ total: sql<number>`count(*)` }).from(transportJobs).where(inArray(transportJobs.status, ["open", "assigned", "in_progress"])),
        database.db.select({ locationName: locations.name, equipmentCount: sql<number>`count(${equipment.id})` })
          .from(locations)
          .leftJoin(pallets, eq(pallets.locationId, locations.id))
          .leftJoin(palletSlots, eq(palletSlots.palletId, pallets.id))
          .leftJoin(equipment, eq(equipment.palletSlotId, palletSlots.id))
          .where(and(sql`lower(coalesce(${locations.type}, '')) <> 'transport'`, ne(locations.name, TRANSPORT_ARCHIVE_LOCATION)))
          .groupBy(locations.id, locations.name)
          .orderBy(asc(locations.name)),
      ]);
      return {
        activeLoans: value(equipmentLoanRows) + value(commsLoanRows),
        activeVehicleLoans: value(vehicleLoanRows),
        totalTransportDistance: value(distanceRows),
        activeTransportJobs: value(transportRows),
        equipmentPerLocation: locationRows.map((row) => ({ locationName: row.locationName, equipmentCount: number(row.equipmentCount) })),
      };
    },

    async search(term) {
      const pattern = createSearchPattern(term);
      if (!pattern) return { equipment: [], loans: [] };
      const [equipmentRows, loanRows] = await Promise.all([
        database.db.select({
          id: equipment.id,
          name: equipment.name,
          serialNumber: equipment.serialNumber,
          locationName: locations.name,
          palletName: pallets.name,
          slotNumber: palletSlots.slotNumber,
        }).from(equipment)
          .leftJoin(palletSlots, eq(palletSlots.id, equipment.palletSlotId))
          .leftJoin(pallets, eq(pallets.id, palletSlots.palletId))
          .leftJoin(locations, eq(locations.id, pallets.locationId))
          .where(or(
            sql<boolean>`${equipment.name} like ${pattern} escape '!'`, sql<boolean>`${equipment.serialNumber} like ${pattern} escape '!'`,
            sql<boolean>`${locations.name} like ${pattern} escape '!'`, sql<boolean>`${pallets.name} like ${pattern} escape '!'`,
            sql<boolean>`cast(${palletSlots.slotNumber} as char) like ${pattern} escape '!'`,
          ))
          .orderBy(asc(equipment.name)).limit(25),
        database.db.select({ id: equipmentLoans.id, equipmentId: equipmentLoans.equipmentId, wannabeId: equipmentLoans.wannabeId, status: equipmentLoans.status, issuedAt: equipmentLoans.issuedAt })
          .from(equipmentLoans)
          .where(sql<boolean>`cast(${equipmentLoans.wannabeId} as char) like ${pattern} escape '!'`)
          .orderBy(sql`${equipmentLoans.issuedAt} desc`).limit(25),
      ]);
      return {
        equipment: equipmentRows,
        loans: loanRows.map((row) => ({ ...row, issuedAt: row.issuedAt.toISOString() })),
      };
    },
  };
}

export function createSearchPattern(term: string): string | null {
  const normalized = Array.from(term.replace(/<[^>]*>/g, "").trim()).slice(0, 100).join("");
  return normalized ? `%${normalized.replace(/[!%_]/g, (character) => `!${character}`)}%` : null;
}

function value(rows: Array<{ total: unknown }>): number { return number(rows[0]?.total); }
function number(value: unknown): number { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
