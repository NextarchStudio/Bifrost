import type { Pallet, PalletInspection } from "@bifrost/contracts";
import { auditLogs, equipment, locations, pallets, palletSlots, type DatabaseConnection } from "@bifrost/database";
import { and, asc, count, eq } from "drizzle-orm";

export interface PalletCreateInput {
  locationId: number;
  name: string;
  qrCode: string;
}

export interface SlotCreateInput {
  slotNumber: number;
  status: string;
}

export class WarehouseDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT") { super(message); }
}

export interface WarehouseService {
  listPallets(): Promise<Pallet[]>;
  inspectPallet(id: number): Promise<PalletInspection>;
  createPallet(input: PalletCreateInput, actorUserId: number): Promise<Pallet>;
  createSlot(palletId: number, input: SlotCreateInput, actorUserId: number): Promise<{ id: number }>;
  addEquipmentByBarcode(palletQrCode: string, equipmentBarcode: string, actorUserId: number): Promise<void>;
  movePallet(id: number, locationId: number, actorUserId: number): Promise<void>;
  deletePallet(id: number, actorUserId: number): Promise<void>;
}

export function createWarehouseService(database: DatabaseConnection): WarehouseService {
  return {
    async listPallets() {
      return database.db.select({
        id: pallets.id,
        locationId: pallets.locationId,
        name: pallets.name,
        qrCode: pallets.qrCode,
        locationName: locations.name,
      }).from(pallets).innerJoin(locations, eq(locations.id, pallets.locationId)).orderBy(asc(pallets.name));
    },

    async inspectPallet(id) {
      const [pallet] = await database.db.select({
        id: pallets.id,
        locationId: pallets.locationId,
        name: pallets.name,
        qrCode: pallets.qrCode,
        locationName: locations.name,
      }).from(pallets).innerJoin(locations, eq(locations.id, pallets.locationId)).where(eq(pallets.id, id)).limit(1);
      if (!pallet) throw new WarehouseDomainError("Palle finnes ikke.", "NOT_FOUND");

      const rows = await database.db.select({
        slotId: palletSlots.id,
        slotNumber: palletSlots.slotNumber,
        slotStatus: palletSlots.status,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        serialNumber: equipment.serialNumber,
        quantity: equipment.quantity,
        equipmentStatus: equipment.status,
      }).from(palletSlots).leftJoin(equipment, eq(equipment.palletSlotId, palletSlots.id))
        .where(eq(palletSlots.palletId, id)).orderBy(asc(palletSlots.slotNumber), asc(equipment.name));
      return { pallet, rows };
    },

    async createPallet(input, actorUserId) {
      return database.db.transaction(async (tx) => {
        const [location] = await tx.select({ id: locations.id, name: locations.name, type: locations.type })
          .from(locations).where(eq(locations.id, input.locationId)).limit(1);
        if (!location) throw new WarehouseDomainError("Lokasjon finnes ikke.", "NOT_FOUND");
        if (location.type.toLocaleLowerCase("nb-NO") === "transport") {
          throw new WarehouseDomainError("Kan ikke opprette palle på lokasjonstype Transport.", "CONFLICT");
        }
        const [duplicate] = await tx.select({ id: pallets.id }).from(pallets).where(eq(pallets.qrCode, input.qrCode)).limit(1);
        if (duplicate) throw new WarehouseDomainError("Strekkode er allerede i bruk på en annen palle.", "CONFLICT");

        const [created] = await tx.insert(pallets).values({ locationId: input.locationId, name: input.name, qrCode: input.qrCode }).$returningId();
        if (!created) throw new Error("Pallen kunne ikke opprettes.");
        await writeAudit(tx, actorUserId, "create", "pallet", created.id, { ...input });
        return { id: created.id, locationId: input.locationId, name: input.name, qrCode: input.qrCode, locationName: location.name };
      });
    },

    async createSlot(palletId, input, actorUserId) {
      return database.db.transaction(async (tx) => {
        const [pallet] = await tx.select({ id: pallets.id }).from(pallets).where(eq(pallets.id, palletId)).limit(1);
        if (!pallet) throw new WarehouseDomainError("Palle finnes ikke.", "NOT_FOUND");
        const [existing] = await tx.select({ id: palletSlots.id }).from(palletSlots)
          .where(and(eq(palletSlots.palletId, palletId), eq(palletSlots.slotNumber, input.slotNumber))).limit(1);
        if (existing) throw new WarehouseDomainError("Palleplassen finnes allerede.", "CONFLICT");
        const [created] = await tx.insert(palletSlots).values({ palletId, slotNumber: input.slotNumber, status: input.status }).$returningId();
        if (!created) throw new Error("Palleplassen kunne ikke opprettes.");
        await writeAudit(tx, actorUserId, "create", "pallet_slot", created.id, { palletId, ...input });
        return { id: created.id };
      });
    },

    async addEquipmentByBarcode(palletQrCode, equipmentBarcode, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [pallet] = await tx.select({ id: pallets.id }).from(pallets).where(eq(pallets.qrCode, palletQrCode)).limit(1);
        if (!pallet) throw new WarehouseDomainError("Palle med strekkode finnes ikke.", "NOT_FOUND");
        const [item] = await tx.select({ id: equipment.id }).from(equipment).where(eq(equipment.serialNumber, equipmentBarcode)).limit(1);
        if (!item) throw new WarehouseDomainError("Utstyr med strekkode finnes ikke.", "NOT_FOUND");

        let [slot] = await tx.select({ id: palletSlots.id }).from(palletSlots)
          .where(and(eq(palletSlots.palletId, pallet.id), eq(palletSlots.slotNumber, 1))).limit(1);
        if (!slot) {
          [slot] = await tx.insert(palletSlots).values({ palletId: pallet.id, slotNumber: 1, status: "available" }).$returningId();
        }
        if (!slot) throw new Error("Palleplassen kunne ikke opprettes.");

        await tx.update(equipment).set({ palletSlotId: slot.id, updatedAt: new Date() }).where(eq(equipment.id, item.id));
        await writeAudit(tx, actorUserId, "move_by_barcode", "equipment", item.id, {
          equipment_barcode: equipmentBarcode,
          pallet_qr_code: palletQrCode,
          pallet_id: pallet.id,
        });
      });
    },

    async movePallet(id, locationId, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [pallet] = await tx.select({ id: pallets.id, locationId: pallets.locationId }).from(pallets).where(eq(pallets.id, id)).limit(1);
        if (!pallet) throw new WarehouseDomainError("Palle finnes ikke.", "NOT_FOUND");
        const [location] = await tx.select({ id: locations.id, type: locations.type }).from(locations).where(eq(locations.id, locationId)).limit(1);
        if (!location) throw new WarehouseDomainError("Lokasjon finnes ikke.", "NOT_FOUND");
        if (location.type.toLocaleLowerCase("nb-NO") === "transport") {
          throw new WarehouseDomainError("Palle kan ikke flyttes til lokasjonstype Transport.", "CONFLICT");
        }
        await tx.update(pallets).set({ locationId }).where(eq(pallets.id, id));
        await writeAudit(tx, actorUserId, "move", "pallet", id, { from_location_id: pallet.locationId, to_location_id: locationId });
      });
    },

    async deletePallet(id, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [pallet] = await tx.select({ name: pallets.name }).from(pallets).where(eq(pallets.id, id)).limit(1);
        if (!pallet) throw new WarehouseDomainError("Palle finnes ikke.", "NOT_FOUND");
        const [usage] = await tx.select({ value: count() }).from(equipment)
          .innerJoin(palletSlots, eq(palletSlots.id, equipment.palletSlotId)).where(eq(palletSlots.palletId, id));
        if ((usage?.value ?? 0) > 0) throw new WarehouseDomainError("Palle kan ikke slettes fordi den inneholder utstyr.", "CONFLICT");
        await tx.delete(pallets).where(eq(pallets.id, id));
        await writeAudit(tx, actorUserId, "delete", "pallet", id, { name: pallet.name });
      });
    },
  };
}

type AuditTransaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];

async function writeAudit(tx: AuditTransaction, actorUserId: number, action: string, entityType: string, entityId: number, diffJson: Record<string, unknown>): Promise<void> {
  await tx.insert(auditLogs).values({ actorUserId, action, entityType, entityId, diffJson, createdAt: new Date() });
}
