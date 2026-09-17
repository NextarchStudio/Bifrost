import type { EquipmentListResponse, EquipmentMutationResponse } from "@bifrost/contracts";
import {
  auditLogs,
  equipment,
  equipmentLoans,
  equipmentRequestItems,
  equipmentRequests,
  locations,
  pallets,
  palletSlots,
  type DatabaseConnection,
} from "@bifrost/database";
import { and, asc, count, eq, inArray, like, ne, notInArray, or, sql, type SQL } from "drizzle-orm";

export interface EquipmentListQuery {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
  status?: string;
}

export interface EquipmentCreateInput {
  name: string;
  category: string;
  serialNumber: string;
  quantity: number;
  notes?: string;
}

export interface EquipmentDetailsInput {
  name: string;
  serialNumber: string;
  quantity: number;
}

export class EquipmentDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT") {
    super(message);
  }
}

export interface EquipmentService {
  list(query: EquipmentListQuery): Promise<EquipmentListResponse>;
  create(input: EquipmentCreateInput, actorUserId: number): Promise<EquipmentMutationResponse>;
  updateDetails(id: number, input: EquipmentDetailsInput, actorUserId: number): Promise<void>;
  updateQuantity(id: number, quantity: number, actorUserId: number): Promise<void>;
  updateStatus(id: number, status: string, actorUserId: number): Promise<void>;
  move(id: number, palletQrCode: string, actorUserId: number): Promise<void>;
  delete(id: number, actorUserId: number): Promise<void>;
}

export function createEquipmentService(database: DatabaseConnection): EquipmentService {
  return {
    async list(query): Promise<EquipmentListResponse> {
      const filters: SQL[] = [];
      if (query.search) {
        const searchFilter = or(like(equipment.name, `%${query.search}%`), like(equipment.serialNumber, `%${query.search}%`));
        if (searchFilter) filters.push(searchFilter);
      }
      if (query.category) filters.push(eq(equipment.category, query.category));
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

    async create(input, actorUserId): Promise<EquipmentMutationResponse> {
      return database.db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: equipment.id, quantity: equipment.quantity, status: equipment.status })
          .from(equipment)
          .where(eq(equipment.serialNumber, input.serialNumber))
          .limit(1);

        if (existing) {
          const quantity = existing.quantity + input.quantity;
          const status = existing.status === "maintenance" ? "maintenance" : quantity > 0 ? "available" : "loaned";
          await tx.update(equipment).set({ quantity, status, updatedAt: new Date() }).where(eq(equipment.id, existing.id));
          await tx.insert(auditLogs).values({
            actorUserId,
            action: "quantity",
            entityType: "equipment",
            entityId: existing.id,
            diffJson: { serial_number: input.serialNumber, added_quantity: input.quantity, quantity },
            createdAt: new Date(),
          });
          return { id: existing.id, merged: true };
        }

        const [created] = await tx.insert(equipment).values({
          name: input.name,
          category: input.category,
          serialNumber: input.serialNumber,
          quantity: input.quantity,
          status: "available",
          palletSlotId: null,
          notes: input.notes || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).$returningId();
        if (!created) throw new Error("Utstyret kunne ikke opprettes.");

        await tx.insert(auditLogs).values({
          actorUserId,
          action: "create",
          entityType: "equipment",
          entityId: created.id,
          diffJson: input,
          createdAt: new Date(),
        });
        return { id: created.id, merged: false };
      });
    },

    async updateDetails(id, input, actorUserId): Promise<void> {
      await database.db.transaction(async (tx) => {
        const [item] = await tx.select({ status: equipment.status }).from(equipment).where(eq(equipment.id, id)).limit(1);
        if (!item) throw new EquipmentDomainError("Utstyr finnes ikke.", "NOT_FOUND");
        const [duplicate] = await tx.select({ id: equipment.id }).from(equipment).where(eq(equipment.serialNumber, input.serialNumber)).limit(1);
        if (duplicate && duplicate.id !== id) throw new EquipmentDomainError("Serienummeret er allerede registrert.", "CONFLICT");

        const status = item.status === "maintenance" ? "maintenance" : input.quantity > 0 ? "available" : "loaned";
        await tx.update(equipment).set({
          name: input.name,
          serialNumber: input.serialNumber,
          quantity: input.quantity,
          status,
          updatedAt: new Date(),
        }).where(eq(equipment.id, id));
        await writeAudit(tx, actorUserId, "update", id, { ...input, status });
      });
    },

    async updateQuantity(id, quantity, actorUserId): Promise<void> {
      await database.db.transaction(async (tx) => {
        const [item] = await tx.select({ status: equipment.status }).from(equipment).where(eq(equipment.id, id)).limit(1);
        if (!item) throw new EquipmentDomainError("Utstyr finnes ikke.", "NOT_FOUND");
        const status = item.status === "maintenance" ? "maintenance" : quantity > 0 ? "available" : "loaned";
        await tx.update(equipment).set({ quantity, status, updatedAt: new Date() }).where(eq(equipment.id, id));
        await writeAudit(tx, actorUserId, "quantity", id, { quantity, status });
      });
    },

    async updateStatus(id, status, actorUserId): Promise<void> {
      await database.db.transaction(async (tx) => {
        const [item] = await tx.select({ id: equipment.id }).from(equipment).where(eq(equipment.id, id)).limit(1);
        if (!item) throw new EquipmentDomainError("Utstyr finnes ikke.", "NOT_FOUND");
        await tx.update(equipment).set({ status, updatedAt: new Date() }).where(eq(equipment.id, id));
        await writeAudit(tx, actorUserId, "status", id, { status });
      });
    },

    async move(id, palletQrCode, actorUserId): Promise<void> {
      await database.db.transaction(async (tx) => {
        const [item] = await tx.select({ id: equipment.id }).from(equipment).where(eq(equipment.id, id)).limit(1);
        if (!item) throw new EquipmentDomainError("Utstyr finnes ikke.", "NOT_FOUND");
        const [pallet] = await tx.select({ id: pallets.id }).from(pallets).where(eq(pallets.qrCode, palletQrCode)).limit(1);
        if (!pallet) throw new EquipmentDomainError("Palle med strekkode finnes ikke.", "NOT_FOUND");

        let [slot] = await tx.select({ id: palletSlots.id }).from(palletSlots)
          .where(and(eq(palletSlots.palletId, pallet.id), eq(palletSlots.slotNumber, 1))).limit(1);
        if (!slot) {
          const [created] = await tx.insert(palletSlots).values({ palletId: pallet.id, slotNumber: 1, status: "available" }).$returningId();
          slot = created;
        }
        if (!slot) throw new Error("Palleplass kunne ikke opprettes.");

        await tx.update(equipment).set({ palletSlotId: slot.id, updatedAt: new Date() }).where(eq(equipment.id, id));
        await writeAudit(tx, actorUserId, "move", id, { pallet_slot_id: slot.id, pallet_qr_code: palletQrCode });
      });
    },

    async delete(id, actorUserId): Promise<void> {
      await database.db.transaction(async (tx) => {
        const [item] = await tx.select({ id: equipment.id, name: equipment.name }).from(equipment).where(eq(equipment.id, id)).limit(1);
        if (!item) throw new EquipmentDomainError("Utstyr finnes ikke.", "NOT_FOUND");

        const [loanRefs] = await tx.select({ value: count() }).from(equipmentLoans)
          .where(and(eq(equipmentLoans.equipmentId, id), ne(equipmentLoans.status, "returned")));
        const [requestRefs] = await tx.select({ value: count() }).from(equipmentRequestItems)
          .innerJoin(equipmentRequests, eq(equipmentRequests.id, equipmentRequestItems.requestId))
          .where(and(eq(equipmentRequestItems.equipmentId, id), notInArray(equipmentRequests.status, ["returned", "rejected"])));
        if ((loanRefs?.value ?? 0) > 0 || (requestRefs?.value ?? 0) > 0) {
          throw new EquipmentDomainError("Utstyr er koblet til aktive utlån eller forespørsler.", "CONFLICT");
        }

        await tx.delete(equipmentLoans).where(and(eq(equipmentLoans.equipmentId, id), eq(equipmentLoans.status, "returned")));
        const removableItems = await tx.select({ id: equipmentRequestItems.id }).from(equipmentRequestItems)
          .innerJoin(equipmentRequests, eq(equipmentRequests.id, equipmentRequestItems.requestId))
          .where(and(eq(equipmentRequestItems.equipmentId, id), inArray(equipmentRequests.status, ["returned", "rejected"])));
        if (removableItems.length > 0) {
          await tx.delete(equipmentRequestItems).where(inArray(equipmentRequestItems.id, removableItems.map((row) => row.id)));
        }
        await tx.delete(equipment).where(eq(equipment.id, id));
        await writeAudit(tx, actorUserId, "delete", id, { name: item.name });
      });
    },
  };
}

type AuditTransaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];

async function writeAudit(
  tx: AuditTransaction,
  actorUserId: number,
  action: string,
  entityId: number,
  diffJson: Record<string, unknown>,
): Promise<void> {
  await tx.insert(auditLogs).values({
    actorUserId,
    action,
    entityType: "equipment",
    entityId,
    diffJson,
    createdAt: new Date(),
  });
}
