import { BIFROST_ACCESS, SHOP_SIZE_OPTIONS, type ShopImportSummary, type ShopItem, type ShopSize, type ShopWorkspaceResponse } from "@bifrost/contracts";
import { auditLogs, shopCategories, shopItems, shopMovements, users, type DatabaseConnection } from "@bifrost/database";
import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";
import type { ShopImportRow } from "./import.js";

export const SHOP_ROLES = BIFROST_ACCESS.shop;

export interface ShopItemInput {
  name: string;
  categoryId?: number | null;
  newCategory?: string | null;
  size?: string | null;
  quantity: number;
  notes?: string | null;
}

export class ShopDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT") { super(message); }
}

export interface ShopService {
  workspace(): Promise<ShopWorkspaceResponse>;
  createCategory(name: string, actorUserId: number): Promise<{ id: number }>;
  createItem(input: ShopItemInput, actorUserId: number): Promise<{ id: number }>;
  move(itemId: number, movementType: "checkin" | "checkout", quantity: number, actorUserId: number): Promise<void>;
  deleteItem(itemId: number, actorUserId: number): Promise<void>;
  importRows(rows: ShopImportRow[], actorUserId: number): Promise<ShopImportSummary>;
}

type DatabaseTransaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];

export function createShopService(database: DatabaseConnection): ShopService {
  return {
    async workspace() {
      await pruneOldDiscontinuedItems(database);
      const [categoryRows, itemRows, movementRows] = await Promise.all([
        database.db.select({ id: shopCategories.id, name: shopCategories.name }).from(shopCategories).orderBy(asc(shopCategories.name)),
        database.db.select({
          id: shopItems.id, categoryId: shopItems.categoryId, categoryName: shopCategories.name, name: shopItems.name,
          size: shopItems.size, quantity: shopItems.quantity, status: shopItems.status, discontinuedAt: shopItems.discontinuedAt,
          notes: shopItems.notes, createdAt: shopItems.createdAt, updatedAt: shopItems.updatedAt,
        }).from(shopItems).innerJoin(shopCategories, eq(shopCategories.id, shopItems.categoryId))
          .orderBy(asc(shopItems.status), asc(shopCategories.name), asc(shopItems.name), asc(shopItems.size)),
        database.db.select({
          id: shopMovements.id, shopItemId: shopMovements.shopItemId, itemName: shopItems.name, itemSize: shopItems.size,
          categoryName: shopCategories.name, actorUserId: shopMovements.actorUserId, actorName: users.name,
          movementType: shopMovements.movementType, quantity: shopMovements.quantity, notes: shopMovements.notes,
          createdAt: shopMovements.createdAt,
        }).from(shopMovements)
          .innerJoin(shopItems, eq(shopItems.id, shopMovements.shopItemId))
          .innerJoin(shopCategories, eq(shopCategories.id, shopItems.categoryId))
          .leftJoin(users, eq(users.id, shopMovements.actorUserId))
          .orderBy(desc(shopMovements.createdAt)).limit(30),
      ]);
      return {
        categories: categoryRows,
        items: itemRows.map(toShopItem),
        movements: movementRows.map((row) => ({
          ...row,
          movementType: row.movementType === "checkout" ? "checkout" : "checkin",
          createdAt: row.createdAt.toISOString(),
        })),
        sizeOptions: SHOP_SIZE_OPTIONS,
      };
    },

    async createCategory(inputName, actorUserId) {
      const name = plainText(inputName, 80);
      if (!name) throw new ShopDomainError("Kategori er påkrevd.", "CONFLICT");
      return database.db.transaction(async (tx) => {
        const [existing] = await tx.select({ id: shopCategories.id }).from(shopCategories).where(eq(shopCategories.name, name)).limit(1);
        if (existing) return existing;
        const now = new Date();
        const [created] = await tx.insert(shopCategories).values({ name, createdAt: now, updatedAt: now }).$returningId();
        if (!created) throw new Error("Kategorien kunne ikke opprettes.");
        await writeAudit(tx, actorUserId, "create", "shop_category", created.id, { name });
        return { id: created.id };
      });
    },

    async createItem(input, actorUserId) {
      return database.db.transaction(async (tx) => {
        const name = plainText(input.name, 150);
        if (name.length < 2) throw new ShopDomainError("Varenavn må inneholde minst to tegn.", "CONFLICT");
        const categoryId = await resolveCategory(tx, input.categoryId ?? null, input.newCategory ?? null, actorUserId);
        const size = normalizeManualSize(input.size);
        const notes = nullableText(input.notes, 4000);
        const now = new Date();
        const [created] = await tx.insert(shopItems).values({
          categoryId, name, size, quantity: input.quantity, status: input.quantity > 0 ? "active" : "discontinued",
          discontinuedAt: input.quantity > 0 ? null : now, notes, createdAt: now, updatedAt: now,
        }).$returningId();
        if (!created) throw new Error("Varen kunne ikke opprettes.");
        if (input.quantity > 0) await tx.insert(shopMovements).values({
          shopItemId: created.id, actorUserId, movementType: "checkin", quantity: input.quantity,
          notes: "Initial lagerbeholdning", createdAt: now,
        });
        await writeAudit(tx, actorUserId, "create", "shop_item", created.id, { category_id: categoryId, name, size, quantity: input.quantity, notes });
        return { id: created.id };
      });
    },

    async move(itemId, movementType, quantity, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [item] = await tx.select().from(shopItems).where(eq(shopItems.id, itemId)).limit(1).for("update");
        if (!item) throw new ShopDomainError("Varen finnes ikke.", "NOT_FOUND");
        if (movementType === "checkout" && quantity > item.quantity) {
          throw new ShopDomainError("Kan ikke sjekke ut mer enn det som er på lager.", "CONFLICT");
        }
        const newQuantity = movementType === "checkout" ? item.quantity - quantity : item.quantity + quantity;
        const now = new Date();
        const label = await actorMovementLabel(tx, actorUserId, movementType);
        await tx.update(shopItems).set({
          quantity: newQuantity,
          status: newQuantity > 0 ? "active" : "discontinued",
          discontinuedAt: newQuantity > 0 ? null : item.discontinuedAt ?? now,
          updatedAt: now,
        }).where(eq(shopItems.id, itemId));
        const [movement] = await tx.insert(shopMovements).values({ shopItemId: itemId, actorUserId, movementType, quantity, notes: label, createdAt: now }).$returningId();
        await writeAudit(tx, actorUserId, movementType, "shop_item", itemId, {
          movement_id: movement?.id ?? null, quantity, notes: label,
          ...(movementType === "checkout" ? { remaining_quantity: newQuantity } : { new_quantity: newQuantity }),
        });
      });
    },

    async deleteItem(itemId, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [item] = await tx.select().from(shopItems).where(eq(shopItems.id, itemId)).limit(1).for("update");
        if (!item) throw new ShopDomainError("Varen finnes ikke.", "NOT_FOUND");
        const movements = await tx.select({ id: shopMovements.id }).from(shopMovements).where(eq(shopMovements.shopItemId, itemId));
        if (movements.length) await tx.delete(shopMovements).where(eq(shopMovements.shopItemId, itemId));
        await tx.delete(shopItems).where(eq(shopItems.id, itemId));
        await writeAudit(tx, actorUserId, "delete", "shop_item", itemId, {
          name: item.name, size: item.size, quantity: item.quantity, deleted_movements: movements.length,
        });
      });
    },

    async importRows(rows, actorUserId) {
      if (!rows.length) throw new ShopDomainError("Fant ingen varer i importfilen.", "CONFLICT");
      return database.db.transaction(async (tx) => {
        const summary: ShopImportSummary = { created: 0, checkedIn: 0, checkedOut: 0, unchanged: 0 };
        const now = new Date();
        for (const row of rows) {
          const name = plainText(row.name, 150);
          if (!name) continue;
          const categoryId = await resolveImportedCategory(tx, row.category, actorUserId);
          const size = normalizeImportedSize(row.size);
          const quantity = Math.max(0, Math.trunc(row.quantity));
          const notes = nullableText(row.notes, 4000);
          let existing = row.id && row.id > 0
            ? (await tx.select().from(shopItems).where(eq(shopItems.id, row.id)).limit(1))[0]
            : undefined;
          if (!existing) {
            const signature = and(eq(shopItems.categoryId, categoryId), eq(shopItems.name, name), size === null ? isNull(shopItems.size) : eq(shopItems.size, size));
            existing = (await tx.select().from(shopItems).where(signature).limit(1))[0];
          }
          if (!existing) {
            const [created] = await tx.insert(shopItems).values({
              categoryId, name, size, quantity, status: quantity > 0 ? "active" : "discontinued",
              discontinuedAt: quantity > 0 ? null : now, notes, createdAt: now, updatedAt: now,
            }).$returningId();
            if (!created) throw new Error("Importvaren kunne ikke opprettes.");
            if (quantity > 0) await tx.insert(shopMovements).values({
              shopItemId: created.id, actorUserId, movementType: "checkin", quantity,
              notes: "Excel-import: ny vare opprettet", createdAt: now,
            });
            await writeAudit(tx, actorUserId, "import_create", "shop_item", created.id, { category_id: categoryId, name, size, quantity });
            summary.created += 1;
            continue;
          }
          if (quantity === existing.quantity) { summary.unchanged += 1; continue; }
          await tx.update(shopItems).set({
            quantity, status: quantity > 0 ? "active" : "discontinued", discontinuedAt: quantity > 0 ? null : now,
            notes: notes ?? existing.notes, updatedAt: now,
          }).where(eq(shopItems.id, existing.id));
          const increased = quantity > existing.quantity;
          const difference = Math.abs(quantity - existing.quantity);
          await tx.insert(shopMovements).values({
            shopItemId: existing.id, actorUserId, movementType: increased ? "checkin" : "checkout", quantity: difference,
            notes: increased ? "Excel-import: justert opp fra varetelling" : "Excel-import: justert ned fra varetelling", createdAt: now,
          });
          await writeAudit(tx, actorUserId, "import_adjust", "shop_item", existing.id, { from_quantity: existing.quantity, to_quantity: quantity });
          if (increased) summary.checkedIn += 1; else summary.checkedOut += 1;
        }
        return summary;
      });
    },
  };
}

async function resolveCategory(tx: DatabaseTransaction, categoryId: number | null, newCategory: string | null, actorUserId: number): Promise<number> {
  const name = plainText(newCategory ?? "", 80);
  if (name) return resolveImportedCategory(tx, name, actorUserId);
  if (!categoryId || categoryId < 1) throw new ShopDomainError("Velg en kategori eller opprett en ny.", "CONFLICT");
  const [category] = await tx.select({ id: shopCategories.id }).from(shopCategories).where(eq(shopCategories.id, categoryId)).limit(1);
  if (!category) throw new ShopDomainError("Kategorien finnes ikke.", "NOT_FOUND");
  return category.id;
}

async function resolveImportedCategory(tx: DatabaseTransaction, value: string, actorUserId: number): Promise<number> {
  const name = plainText(value, 80) || "Ukjent";
  const [existing] = await tx.select({ id: shopCategories.id }).from(shopCategories).where(eq(shopCategories.name, name)).limit(1);
  if (existing) return existing.id;
  const now = new Date();
  const [created] = await tx.insert(shopCategories).values({ name, createdAt: now, updatedAt: now }).$returningId();
  if (!created) throw new Error("Importkategorien kunne ikke opprettes.");
  await writeAudit(tx, actorUserId, "create", "shop_category", created.id, { name });
  return created.id;
}

async function actorMovementLabel(tx: DatabaseTransaction, actorUserId: number, movementType: "checkin" | "checkout"): Promise<string> {
  const [user] = await tx.select({ name: users.name, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, actorUserId)).limit(1);
  const action = movementType === "checkout" ? "Utsjekket" : "Innsjekket";
  if (!user) return `${action} av ukjent bruker`;
  const name = `${user.firstName} ${user.lastName}`.trim() || user.name.trim();
  return name ? `${action} av ${name}` : `${action} av bruker #${actorUserId}`;
}

async function pruneOldDiscontinuedItems(database: DatabaseConnection): Promise<void> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  await database.db.transaction(async (tx) => {
    const oldItems = await tx.select({ id: shopItems.id }).from(shopItems)
      .where(and(eq(shopItems.status, "discontinued"), lte(shopItems.discontinuedAt, cutoff))).for("update");
    for (const item of oldItems) {
      await tx.delete(shopMovements).where(eq(shopMovements.shopItemId, item.id));
      await tx.delete(shopItems).where(eq(shopItems.id, item.id));
    }
  });
}

function toShopItem(row: {
  id: number; categoryId: number; categoryName: string; name: string; size: string | null; quantity: number; status: string;
  discontinuedAt: Date | null; notes: string | null; createdAt: Date; updatedAt: Date;
}): ShopItem {
  return { ...row, discontinuedAt: row.discontinuedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function normalizeManualSize(value?: string | null): ShopSize | null {
  const size = plainText(value ?? "", 20).toUpperCase();
  if (!size) return null;
  if (!(SHOP_SIZE_OPTIONS as readonly string[]).includes(size)) throw new ShopDomainError("Ugyldig størrelse.", "CONFLICT");
  return size as ShopSize;
}

function normalizeImportedSize(value?: string | null): string | null {
  const size = plainText(value ?? "", 20);
  if (!size || size === "-") return null;
  const upper = size.toUpperCase();
  return (SHOP_SIZE_OPTIONS as readonly string[]).includes(upper) ? upper : size;
}

function plainText(value: string, limit: number): string { return value.replace(/<[^>]*>/g, "").trim().slice(0, limit); }
function nullableText(value: string | null | undefined, limit: number): string | null { const text = plainText(value ?? "", limit); return text || null; }

async function writeAudit(tx: DatabaseTransaction, actorUserId: number, action: string, entityType: string, entityId: number, diff: unknown): Promise<void> {
  await tx.insert(auditLogs).values({ actorUserId, action, entityType, entityId, diffJson: diff, createdAt: new Date() });
}
