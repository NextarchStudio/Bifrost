import type { EquipmentListResponse } from "@bifrost/contracts";
import {
  equipment,
  equipmentLoans,
  locations,
  pallets,
  palletSlots,
  type DatabaseConnection,
} from "@bifrost/database";
import { and, asc, count, eq, like, sql, type SQL } from "drizzle-orm";

export interface EquipmentListQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
}

export interface EquipmentService {
  list(query: EquipmentListQuery): Promise<EquipmentListResponse>;
}

export function createEquipmentService(database: DatabaseConnection): EquipmentService {
  return {
    async list(query): Promise<EquipmentListResponse> {
      const filters: SQL[] = [];
      if (query.search) filters.push(like(equipment.name, `%${query.search}%`));
      if (query.status) filters.push(eq(equipment.status, query.status));
      const where = filters.length > 0 ? and(...filters) : undefined;

      const [totalRow] = await database.db.select({ value: count() }).from(equipment).where(where);
      const total = totalRow?.value ?? 0;
      const activeLoans = database.db
        .select({
          equipmentId: equipmentLoans.equipmentId,
          quantity: sql<number>`coalesce(sum(${equipmentLoans.quantity}), 0)`.mapWith(Number).as("loaned_quantity"),
        })
        .from(equipmentLoans)
        .where(eq(equipmentLoans.status, "active"))
        .groupBy(equipmentLoans.equipmentId)
        .as("active_loans");

      const rows = await database.db
        .select({
          id: equipment.id,
          name: equipment.name,
          category: equipment.category,
          serialNumber: equipment.serialNumber,
          quantity: equipment.quantity,
          loanedQuantity: activeLoans.quantity,
          status: equipment.status,
          locationName: locations.name,
          palletName: pallets.name,
          slotNumber: palletSlots.slotNumber,
          updatedAt: equipment.updatedAt,
        })
        .from(equipment)
        .leftJoin(palletSlots, eq(palletSlots.id, equipment.palletSlotId))
        .leftJoin(pallets, eq(pallets.id, palletSlots.palletId))
        .leftJoin(locations, eq(locations.id, pallets.locationId))
        .leftJoin(activeLoans, eq(activeLoans.equipmentId, equipment.id))
        .where(where)
        .orderBy(asc(equipment.name), asc(equipment.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);

      return {
        items: rows.map((row) => ({
          ...row,
          loanedQuantity: row.loanedQuantity ?? 0,
          updatedAt: row.updatedAt.toISOString(),
        })),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          pageCount: Math.ceil(total / query.pageSize),
        },
      };
    },
  };
}
