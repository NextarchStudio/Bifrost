import type { EquipmentCategory } from "@bifrost/contracts";
import { auditLogs, equipment, equipmentCategories, type DatabaseConnection } from "@bifrost/database";
import { asc, count, eq } from "drizzle-orm";

export class CategoryDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT") { super(message); }
}

export interface CategoryService {
  list(): Promise<EquipmentCategory[]>;
  create(name: string, actorUserId: number): Promise<EquipmentCategory>;
  delete(id: number, actorUserId: number): Promise<void>;
}

export function createCategoryService(database: DatabaseConnection): CategoryService {
  return {
    async list() {
      return database.db.select({ id: equipmentCategories.id, name: equipmentCategories.name })
        .from(equipmentCategories).orderBy(asc(equipmentCategories.name));
    },

    async create(name, actorUserId) {
      return database.db.transaction(async (tx) => {
        const [existing] = await tx.select({ id: equipmentCategories.id }).from(equipmentCategories)
          .where(eq(equipmentCategories.name, name)).limit(1);
        if (existing) throw new CategoryDomainError("Kategori finnes allerede.", "CONFLICT");
        const now = new Date();
        const [created] = await tx.insert(equipmentCategories).values({ name, createdAt: now, updatedAt: now }).$returningId();
        if (!created) throw new Error("Kategori kunne ikke opprettes.");
        await tx.insert(auditLogs).values({ actorUserId, action: "create", entityType: "equipment_category", entityId: created.id, diffJson: { name }, createdAt: now });
        return { id: created.id, name };
      });
    },

    async delete(id, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [category] = await tx.select({ name: equipmentCategories.name }).from(equipmentCategories)
          .where(eq(equipmentCategories.id, id)).limit(1);
        if (!category) throw new CategoryDomainError("Kategori finnes ikke.", "NOT_FOUND");
        const [usage] = await tx.select({ value: count() }).from(equipment).where(eq(equipment.category, category.name));
        if ((usage?.value ?? 0) > 0) throw new CategoryDomainError("Kategori brukes av utstyr og kan ikke slettes.", "CONFLICT");
        await tx.delete(equipmentCategories).where(eq(equipmentCategories.id, id));
        await tx.insert(auditLogs).values({ actorUserId, action: "delete", entityType: "equipment_category", entityId: id, diffJson: { name: category.name }, createdAt: new Date() });
      });
    },
  };
}
