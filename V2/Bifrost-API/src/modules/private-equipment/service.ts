import type { PrivateEquipmentNotice, PrivateEquipmentRule } from "@bifrost/contracts";
import { auditLogs, equipment, privateEquipmentPrefixes, type DatabaseConnection } from "@bifrost/database";
import { asc, eq, sql } from "drizzle-orm";

export class PrivateEquipmentDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID") { super(message); }
}

export interface PrivateEquipmentService {
  list(): Promise<PrivateEquipmentRule[]>;
  listNotices(): Promise<PrivateEquipmentNotice[]>;
  create(input: { ownerName: string; barcodePrefix: string }, actorUserId: number): Promise<PrivateEquipmentRule>;
  delete(id: number, actorUserId: number): Promise<void>;
}

export function createPrivateEquipmentService(database: DatabaseConnection): PrivateEquipmentService {
  const listNotices = async (): Promise<PrivateEquipmentNotice[]> => {
    const rows = await database.db.select({
      ownerName: privateEquipmentPrefixes.ownerName,
      barcodePrefix: privateEquipmentPrefixes.barcodePrefix,
    }).from(privateEquipmentPrefixes).orderBy(asc(privateEquipmentPrefixes.barcodePrefix));
    return rows.map(toNotice);
  };

  return {
    async list() {
      const prefixes = await database.db.select().from(privateEquipmentPrefixes)
        .orderBy(asc(privateEquipmentPrefixes.barcodePrefix));
      return Promise.all(prefixes.map(async (rule) => {
        const normalizedPrefix = rule.barcodePrefix.toUpperCase();
        const items = await database.db.select({
          id: equipment.id,
          name: equipment.name,
          serialNumber: equipment.serialNumber,
          quantity: equipment.quantity,
          status: equipment.status,
        }).from(equipment)
          .where(sql`upper(left(${equipment.serialNumber}, ${normalizedPrefix.length})) = ${normalizedPrefix}`)
          .orderBy(asc(equipment.serialNumber));
        const notice = toNotice(rule);
        return {
          id: rule.id,
          barcodePrefix: normalizedPrefix,
          equipmentCount: items.length,
          lowestSerial: items[0]?.serialNumber ?? null,
          highestSerial: items.at(-1)?.serialNumber ?? null,
          equipmentItems: items,
          ...notice,
        };
      }));
    },

    listNotices,

    async create(input, actorUserId) {
      const ownerName = input.ownerName.trim().slice(0, 180);
      const barcodePrefix = input.barcodePrefix.trim().toUpperCase();
      if (!/^[A-Z0-9._-]+$/.test(barcodePrefix)) {
        throw new PrivateEquipmentDomainError("Strekkodeprefiks kan bare inneholde bokstaver, tall, bindestrek, understrek og punktum.", "INVALID");
      }
      return database.db.transaction(async (tx) => {
        const [existing] = await tx.select({ id: privateEquipmentPrefixes.id }).from(privateEquipmentPrefixes)
          .where(eq(privateEquipmentPrefixes.barcodePrefix, barcodePrefix)).limit(1);
        if (existing) throw new PrivateEquipmentDomainError("Dette prefikset finnes allerede.", "CONFLICT");
        const now = new Date();
        const [created] = await tx.insert(privateEquipmentPrefixes).values({ ownerName, barcodePrefix, createdAt: now, updatedAt: now }).$returningId();
        if (!created) throw new Error("Privat utstyr-regelen kunne ikke opprettes.");
        await tx.insert(auditLogs).values({
          actorUserId,
          action: "create",
          entityType: "private_equipment_prefix",
          entityId: created.id,
          diffJson: { owner_name: ownerName, barcode_prefix: barcodePrefix },
          createdAt: now,
        });
        return {
          id: created.id,
          barcodePrefix,
          equipmentCount: 0,
          lowestSerial: null,
          highestSerial: null,
          equipmentItems: [],
          ...toNotice({ ownerName, barcodePrefix }),
        };
      });
    },

    async delete(id, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [existing] = await tx.select({
          ownerName: privateEquipmentPrefixes.ownerName,
          barcodePrefix: privateEquipmentPrefixes.barcodePrefix,
        }).from(privateEquipmentPrefixes).where(eq(privateEquipmentPrefixes.id, id)).limit(1);
        if (!existing) throw new PrivateEquipmentDomainError("Privat utstyr-regelen finnes ikke.", "NOT_FOUND");
        await tx.delete(privateEquipmentPrefixes).where(eq(privateEquipmentPrefixes.id, id));
        await tx.insert(auditLogs).values({
          actorUserId,
          action: "delete",
          entityType: "private_equipment_prefix",
          entityId: id,
          diffJson: { owner_name: existing.ownerName, barcode_prefix: existing.barcodePrefix },
          createdAt: new Date(),
        });
      });
    },
  };
}

function toNotice(rule: { ownerName: string; barcodePrefix: string }): PrivateEquipmentNotice {
  const prefix = rule.barcodePrefix.toUpperCase();
  return {
    ownerName: rule.ownerName.trim(),
    prefix,
    issueMessage: `Dette er en eiendel av ${rule.ownerName.trim()}. Bekreft at du har blitt spurt før den lånes ut.`,
    returnMessage: `Dette er en eiendel av ${rule.ownerName.trim()}. Gi eiendelen til ${rule.ownerName.trim()}.`,
  };
}
