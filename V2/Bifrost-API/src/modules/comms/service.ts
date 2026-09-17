import type {
  CommsItem,
  CommsItemType,
  CommsLoan,
  CommsSet,
  CommsWorkspaceResponse,
} from "@bifrost/contracts";
import {
  auditLogs,
  commsItems,
  commsLoanItems,
  commsLoans,
  commsSetItems,
  commsSets,
  crewDirectoryCache,
  users,
  type DatabaseConnection,
} from "@bifrost/database";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { CrewDirectoryService } from "../crew/service.js";

export const COMMS_ROLES: ReadonlySet<string> = new Set(["developer", "chief", "co-chief", "logistikk", "sambandsansvarlig"]);

export interface CommsItemInput {
  name: string;
  type: CommsItemType;
  serialNumber?: string | null;
  quantity: number;
  notes?: string | null;
}

export interface CommsSetInput {
  name: string;
  notes?: string | null;
  items: Array<{ itemId: number; quantity: number }>;
}

export type CommsLoanIssueInput =
  | { wannabeId: number; loanType: "item"; itemId: number; quantity: number; notes?: string | null }
  | { wannabeId: number; loanType: "set"; setId: number; notes?: string | null };

export interface CommsLoanReturnInput {
  returns: Array<{ itemId: number; quantity: number }>;
  replacementItemId?: number | null;
  replacementQuantity?: number | null;
}

export class CommsDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT") { super(message); }
}

export interface CommsService {
  workspace(): Promise<CommsWorkspaceResponse>;
  createItem(input: CommsItemInput, actorUserId: number): Promise<{ id: number }>;
  createSet(input: CommsSetInput, actorUserId: number): Promise<{ id: number }>;
  updateSet(id: number, input: CommsSetInput, actorUserId: number): Promise<void>;
  deleteSet(id: number, actorUserId: number): Promise<void>;
  issue(input: CommsLoanIssueInput, actorUserId: number): Promise<{ loanId: number }>;
  returnLoan(id: number, input: CommsLoanReturnInput, actorUserId: number): Promise<void>;
}

type DatabaseTransaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];
type ItemRow = typeof commsItems.$inferSelect;

export function createCommsService(database: DatabaseConnection, crew?: CrewDirectoryService): CommsService {
  return {
    async workspace() {
      const [itemRows, setRows, setItemRows, loanRows, loanItemRows] = await Promise.all([
        database.db.select().from(commsItems).orderBy(asc(commsItems.name)),
        database.db.select().from(commsSets).orderBy(asc(commsSets.name)),
        database.db.select().from(commsSetItems).orderBy(asc(commsSetItems.id)),
        database.db.select().from(commsLoans).where(eq(commsLoans.status, "active")).orderBy(desc(commsLoans.issuedAt)),
        database.db.select().from(commsLoanItems).orderBy(asc(commsLoanItems.id)),
      ]);
      const wannabeIds = [...new Set(loanRows.map((loan) => loan.wannabeId))];
      const [userRows, cacheRows] = await Promise.all([
        wannabeIds.length ? database.db.select({ wannabeId: users.wannabeId, name: users.name }).from(users).where(inArray(users.wannabeId, wannabeIds)) : Promise.resolve([]),
        wannabeIds.length ? database.db.select({ wannabeId: crewDirectoryCache.wannabeId, name: crewDirectoryCache.name }).from(crewDirectoryCache).where(inArray(crewDirectoryCache.wannabeId, wannabeIds)) : Promise.resolve([]),
      ]);
      const itemsById = new Map(itemRows.map((item) => [item.id, item]));
      const setsById = new Map(setRows.map((set) => [set.id, set]));
      const setItemsBySetId = groupBy(setItemRows, (item) => item.setId);
      const loanItemsByLoanId = groupBy(loanItemRows.filter((item) => loanRows.some((loan) => loan.id === item.loanId)), (item) => item.loanId);
      const activeLoansBySetId = new Map<number, number>();
      for (const loan of loanRows) if (loan.setId) activeLoansBySetId.set(loan.setId, (activeLoansBySetId.get(loan.setId) ?? 0) + 1);
      const namesByWannabe = new Map<number, string>();
      for (const row of cacheRows) if (row.name?.trim()) namesByWannabe.set(row.wannabeId, row.name.trim());
      for (const row of userRows) if (row.wannabeId && row.name.trim()) namesByWannabe.set(row.wannabeId, row.name.trim());
      if (crew) {
        for (const wannabeId of wannabeIds) {
          if (namesByWannabe.has(wannabeId)) continue;
          try { namesByWannabe.set(wannabeId, (await crew.lookup(String(wannabeId))).displayName); } catch { /* V1 also keeps the loan visible when enrichment fails. */ }
        }
      }

      const items = itemRows.map(toItem);
      const sets: CommsSet[] = setRows.map((set) => {
        const lines = (setItemsBySetId.get(set.id) ?? []).flatMap((line) => {
          const item = itemsById.get(line.itemId);
          return item ? [{
            id: line.id,
            itemId: line.itemId,
            itemName: item.name,
            itemType: normalizeType(item.type),
            availableQuantity: item.quantity,
            status: item.status,
            quantity: line.quantity,
          }] : [];
        });
        return {
          id: set.id,
          name: set.name,
          notes: set.notes,
          itemsSummary: lines.map((line) => `${line.itemName} x${line.quantity}`).sort((a, b) => a.localeCompare(b, "nb-NO")).join(", "),
          activeLoanCount: activeLoansBySetId.get(set.id) ?? 0,
          items: lines,
          createdAt: set.createdAt.toISOString(),
          updatedAt: set.updatedAt.toISOString(),
        };
      });
      const activeLoans: CommsLoan[] = loanRows.map((loan) => {
        const lines = (loanItemsByLoanId.get(loan.id) ?? []).flatMap((line) => {
          const item = itemsById.get(line.itemId);
          return item ? [{
            id: line.id,
            itemId: line.itemId,
            itemName: item.name,
            itemType: normalizeType(item.type),
            serialNumber: item.serialNumber,
            quantity: line.quantity,
          }] : [];
        });
        return {
          id: loan.id,
          wannabeId: loan.wannabeId,
          borrowerName: namesByWannabe.get(loan.wannabeId) ?? null,
          issuedByUserId: loan.issuedByUserId,
          setId: loan.setId,
          setName: loan.setId ? setsById.get(loan.setId)?.name ?? null : null,
          itemsSummary: lines.map((line) => `${line.itemName} x${line.quantity}`).sort((a, b) => a.localeCompare(b, "nb-NO")).join(", "),
          totalItems: lines.reduce((total, line) => total + line.quantity, 0),
          issuedAt: loan.issuedAt.toISOString(),
          notes: loan.notes,
          items: lines,
        };
      });
      return { items, sets, activeLoans };
    },

    async createItem(input, actorUserId) {
      return database.db.transaction(async (tx) => {
        const name = plainText(input.name, 140);
        if (!name) throw new CommsDomainError("Navn på samband/tilbehør er påkrevd.", "CONFLICT");
        const now = new Date();
        const [created] = await tx.insert(commsItems).values({
          name,
          type: input.type,
          serialNumber: nullableText(input.serialNumber, 150),
          quantity: input.quantity,
          status: "available",
          notes: nullableText(input.notes, 2000),
          createdAt: now,
          updatedAt: now,
        }).$returningId();
        if (!created) throw new Error("Sambandsutstyret kunne ikke opprettes.");
        await writeAudit(tx, actorUserId, "create", "comms_item", created.id, { name: input.name, type: input.type, quantity: input.quantity });
        return { id: created.id };
      });
    },

    async createSet(input, actorUserId) {
      return database.db.transaction(async (tx) => {
        const normalized = normalizeSetInput(input);
        await assertItemsExist(tx, normalized.items.map((item) => item.itemId));
        const now = new Date();
        const [created] = await tx.insert(commsSets).values({ name: normalized.name, notes: normalized.notes, createdAt: now, updatedAt: now }).$returningId();
        if (!created) throw new Error("Sambandssettet kunne ikke opprettes.");
        await tx.insert(commsSetItems).values(normalized.items.map((item) => ({ setId: created.id, ...item })));
        await writeAudit(tx, actorUserId, "create", "comms_set", created.id, { name: normalized.name, items: normalized.items });
        return { id: created.id };
      });
    },

    async updateSet(id, input, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [set] = await tx.select().from(commsSets).where(eq(commsSets.id, id)).limit(1).for("update");
        if (!set) throw new CommsDomainError("Sambandssettet finnes ikke.", "NOT_FOUND");
        const normalized = normalizeSetInput(input);
        await assertItemsExist(tx, normalized.items.map((item) => item.itemId));
        const now = new Date();
        await tx.update(commsSets).set({ name: normalized.name, notes: normalized.notes, updatedAt: now }).where(eq(commsSets.id, id));
        await tx.delete(commsSetItems).where(eq(commsSetItems.setId, id));
        await tx.insert(commsSetItems).values(normalized.items.map((item) => ({ setId: id, ...item })));
        await writeAudit(tx, actorUserId, "update", "comms_set", id, { name: normalized.name, items: normalized.items });
      });
    },

    async deleteSet(id, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [set] = await tx.select().from(commsSets).where(eq(commsSets.id, id)).limit(1).for("update");
        if (!set) throw new CommsDomainError("Sambandssettet finnes ikke.", "NOT_FOUND");
        const [activeLoan] = await tx.select({ id: commsLoans.id }).from(commsLoans)
          .where(and(eq(commsLoans.setId, id), eq(commsLoans.status, "active"))).limit(1);
        if (activeLoan) throw new CommsDomainError("Sambandssettet kan ikke slettes mens det er utlånt.", "CONFLICT");
        await tx.delete(commsSets).where(eq(commsSets.id, id));
        await writeAudit(tx, actorUserId, "delete", "comms_set", id, { name: set.name });
      });
    },

    async issue(input, actorUserId) {
      return database.db.transaction(async (tx) => {
        let setId: number | null = null;
        let requestedLines: Array<{ itemId: number; quantity: number }>;
        if (input.loanType === "item") {
          requestedLines = [{ itemId: input.itemId, quantity: input.quantity }];
        } else {
          setId = input.setId;
          const [set] = await tx.select({ id: commsSets.id }).from(commsSets).where(eq(commsSets.id, input.setId)).limit(1);
          if (!set) throw new CommsDomainError("Valgt sambandssett finnes ikke.", "NOT_FOUND");
          requestedLines = await tx.select({ itemId: commsSetItems.itemId, quantity: commsSetItems.quantity })
            .from(commsSetItems).where(eq(commsSetItems.setId, input.setId));
          if (!requestedLines.length) throw new CommsDomainError("Valgt sambandssett har ingen linjer.", "CONFLICT");
        }
        const itemIds = requestedLines.map((line) => line.itemId);
        const inventory = await tx.select().from(commsItems).where(inArray(commsItems.id, itemIds)).for("update");
        const inventoryById = new Map(inventory.map((item) => [item.id, item]));
        for (const line of requestedLines) {
          const item = inventoryById.get(line.itemId);
          if (!item) throw new CommsDomainError("Valgt samband/tilbehør finnes ikke.", "NOT_FOUND");
          if (item.quantity < line.quantity) throw new CommsDomainError(`Ikke nok antall tilgjengelig for ${item.name}.`, "CONFLICT");
        }
        const now = new Date();
        const [created] = await tx.insert(commsLoans).values({
          wannabeId: input.wannabeId,
          issuedByUserId: actorUserId,
          setId,
          issuedAt: now,
          returnedAt: null,
          status: "active",
          notes: nullableText(input.notes, 2000),
        }).$returningId();
        if (!created) throw new Error("Sambandslånet kunne ikke opprettes.");
        await tx.insert(commsLoanItems).values(requestedLines.map((line) => ({ loanId: created.id, ...line })));
        for (const line of requestedLines) {
          const item = inventoryById.get(line.itemId)!;
          const remaining = item.quantity - line.quantity;
          await tx.update(commsItems).set({ quantity: remaining, status: remaining > 0 ? "available" : "loaned", updatedAt: now }).where(eq(commsItems.id, item.id));
        }
        await writeAudit(tx, actorUserId, "issue", "comms_loan", created.id, {
          loan_type: input.loanType, set_id: setId, wannabe_id: input.wannabeId, items: requestedLines,
        });
        return { loanId: created.id };
      });
    },

    async returnLoan(id, input, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [loan] = await tx.select().from(commsLoans).where(eq(commsLoans.id, id)).limit(1).for("update");
        if (!loan) throw new CommsDomainError("Sambandslånet finnes ikke.", "NOT_FOUND");
        if (loan.status !== "active") throw new CommsDomainError("Sambandslånet er allerede returnert.", "CONFLICT");
        const lines = await tx.select().from(commsLoanItems).where(eq(commsLoanItems.loanId, id)).for("update");
        const linesByItemId = new Map(lines.map((line) => [line.itemId, { ...line }]));
        const returns = input.returns.filter((line) => line.quantity > 0);
        const replacementItemId = input.replacementItemId ?? null;
        const replacementQuantity = input.replacementQuantity ?? 0;
        if (!returns.length && !(replacementItemId && replacementQuantity > 0)) {
          throw new CommsDomainError("Velg minst én delretur eller et bytte.", "CONFLICT");
        }
        for (const returned of returns) {
          const line = linesByItemId.get(returned.itemId);
          if (!line) throw new CommsDomainError("Valgt utstyr finnes ikke på dette lånet.", "CONFLICT");
          if (returned.quantity > line.quantity) throw new CommsDomainError(`Du kan ikke returnere flere enn det som er utlånt for valgt linje.`, "CONFLICT");
        }
        const affectedIds = [...new Set([...returns.map((line) => line.itemId), ...(replacementItemId ? [replacementItemId] : [])])];
        const inventory = affectedIds.length ? await tx.select().from(commsItems).where(inArray(commsItems.id, affectedIds)).for("update") : [];
        const inventoryById = new Map(inventory.map((item) => [item.id, { ...item }]));
        const now = new Date();
        for (const returned of returns) {
          const line = linesByItemId.get(returned.itemId)!;
          const item = inventoryById.get(returned.itemId);
          if (!item) throw new CommsDomainError("Sambandsutstyret finnes ikke.", "NOT_FOUND");
          item.quantity += returned.quantity;
          await tx.update(commsItems).set({ quantity: item.quantity, status: "available", updatedAt: now }).where(eq(commsItems.id, item.id));
          line.quantity -= returned.quantity;
          if (line.quantity > 0) await tx.update(commsLoanItems).set({ quantity: line.quantity }).where(eq(commsLoanItems.id, line.id));
          else { await tx.delete(commsLoanItems).where(eq(commsLoanItems.id, line.id)); linesByItemId.delete(returned.itemId); }
        }
        if (replacementItemId && replacementQuantity > 0) {
          const replacement = inventoryById.get(replacementItemId);
          if (!replacement) throw new CommsDomainError("Valgt erstatningsutstyr finnes ikke.", "NOT_FOUND");
          if (replacement.quantity < replacementQuantity) throw new CommsDomainError("Ikke nok antall tilgjengelig for valgt erstatningsutstyr.", "CONFLICT");
          const existing = linesByItemId.get(replacementItemId);
          if (existing) {
            existing.quantity += replacementQuantity;
            await tx.update(commsLoanItems).set({ quantity: existing.quantity }).where(eq(commsLoanItems.id, existing.id));
          } else {
            const [createdLine] = await tx.insert(commsLoanItems).values({ loanId: id, itemId: replacementItemId, quantity: replacementQuantity }).$returningId();
            if (!createdLine) throw new Error("Erstatningsutstyret kunne ikke legges til lånet.");
            linesByItemId.set(replacementItemId, { id: createdLine.id, loanId: id, itemId: replacementItemId, quantity: replacementQuantity });
          }
          replacement.quantity -= replacementQuantity;
          await tx.update(commsItems).set({ quantity: replacement.quantity, status: replacement.quantity > 0 ? "available" : "loaned", updatedAt: now }).where(eq(commsItems.id, replacementItemId));
        }
        const returnedAll = linesByItemId.size === 0;
        await tx.update(commsLoans).set({ status: returnedAll ? "returned" : "active", returnedAt: returnedAll ? now : null }).where(eq(commsLoans.id, id));
        await writeAudit(tx, actorUserId, "return", "comms_loan", id, {
          returns,
          replacement_item_id: replacementItemId,
          replacement_quantity: replacementQuantity || null,
        });
      });
    },
  };
}

function toItem(item: ItemRow): CommsItem {
  return {
    id: item.id,
    name: item.name,
    type: normalizeType(item.type),
    serialNumber: item.serialNumber,
    quantity: item.quantity,
    status: item.status,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function normalizeSetInput(input: CommsSetInput): { name: string; notes: string | null; items: Array<{ itemId: number; quantity: number }> } {
  const name = plainText(input.name, 120);
  if (!name) throw new CommsDomainError("Navn på sambandssett er påkrevd.", "CONFLICT");
  const merged = new Map<number, number>();
  for (const item of input.items) merged.set(item.itemId, item.quantity);
  const items = [...merged].map(([itemId, quantity]) => ({ itemId, quantity }));
  if (!items.length) throw new CommsDomainError("Velg minst ett samband/tilbehør i settet.", "CONFLICT");
  return { name, notes: nullableText(input.notes, 2000), items };
}

async function assertItemsExist(tx: DatabaseTransaction, itemIds: number[]): Promise<void> {
  const rows = await tx.select({ id: commsItems.id }).from(commsItems).where(inArray(commsItems.id, itemIds));
  if (rows.length !== new Set(itemIds).size) throw new CommsDomainError("Ett eller flere valgte samband/tilbehør finnes ikke.", "NOT_FOUND");
}

function normalizeType(value: string): CommsItemType {
  return value === "tilbehor" ? "tilbehor" : "samband";
}

function plainText(value: string, maxLength: number): string {
  return value.replace(/<[^>]*>/g, "").trim().slice(0, maxLength);
}

function nullableText(value: string | null | undefined, maxLength: number): string | null {
  const normalized = plainText(value ?? "", maxLength);
  return normalized || null;
}

function groupBy<T>(rows: T[], key: (row: T) => number): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const row of rows) grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]);
  return grouped;
}

async function writeAudit(tx: DatabaseTransaction, actorUserId: number, action: string, entityType: string, entityId: number, diffJson: Record<string, unknown>): Promise<void> {
  await tx.insert(auditLogs).values({ actorUserId, action, entityType, entityId, diffJson, createdAt: new Date() });
}
