import {
  SHOP_SIZE_OPTIONS,
  type CrewClothingCrew,
  type CrewClothingInventoryItem,
  type CrewClothingItemType,
  type CrewClothingMember,
  type CrewClothingWorkspaceResponse,
  type ShopSize,
} from "@bifrost/contracts";
import {
  auditLogs,
  crewClothingCrews,
  crewClothingInventory,
  crewClothingMembers,
  type DatabaseConnection,
} from "@bifrost/database";
import { and, asc, desc, eq } from "drizzle-orm";
import type { CrewDirectoryService } from "../crew/service.js";

export const CREW_CLOTHING_ROLES: ReadonlySet<string> = new Set(["developer", "chief", "co-chief", "logistikk", "shop"]);
export const CREW_CLOTHING_ADMIN_ROLES: ReadonlySet<string> = new Set(["developer", "chief", "co-chief"]);

export interface CrewInput { name: string; tshirtMax: number; hoodieMax: number; }
export interface MemberInput { crewId?: number | null; tshirtSize?: string | null; hoodieSize?: string | null; }
export interface ClothingInventoryInput { itemType: CrewClothingItemType; size: string; quantity: number; }

export class CrewClothingDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT") { super(message); }
}

export interface CrewClothingService {
  workspace(canManageCrews: boolean): Promise<CrewClothingWorkspaceResponse>;
  lookup(query: string): Promise<CrewClothingMember>;
  createCrew(input: CrewInput, actorUserId: number): Promise<{ id: number }>;
  updateCrew(id: number, input: CrewInput, actorUserId: number): Promise<void>;
  updateMember(id: number, input: MemberInput, actorUserId: number): Promise<void>;
  setDelivered(id: number, itemTypes: CrewClothingItemType[], delivered: boolean, actorUserId: number): Promise<void>;
  saveInventory(input: ClothingInventoryInput, actorUserId: number): Promise<{ id: number }>;
  updateInventory(id: number, input: ClothingInventoryInput, actorUserId: number): Promise<void>;
  deleteInventory(id: number, actorUserId: number): Promise<void>;
}

type DatabaseTransaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];
type MemberRow = typeof crewClothingMembers.$inferSelect;

export function createCrewClothingService(database: DatabaseConnection, crewDirectory: CrewDirectoryService): CrewClothingService {
  return {
    async workspace(canManageCrews) {
      const [crewRows, memberRows, inventoryRows] = await Promise.all([
        database.db.select().from(crewClothingCrews).orderBy(asc(crewClothingCrews.name)),
        database.db.select().from(crewClothingMembers).orderBy(desc(crewClothingMembers.updatedAt), asc(crewClothingMembers.name)),
        database.db.select().from(crewClothingInventory).orderBy(asc(crewClothingInventory.itemType), asc(crewClothingInventory.size)),
      ]);
      const crewsById = new Map(crewRows.map((crew) => [crew.id, crew]));
      const summary = new Map<number, { members: number; tshirts: number; hoodies: number }>();
      for (const member of memberRows) {
        if (!member.crewId) continue;
        const current = summary.get(member.crewId) ?? { members: 0, tshirts: 0, hoodies: 0 };
        current.members += 1;
        if (member.tshirtDelivered) current.tshirts += 1;
        if (member.hoodieDelivered) current.hoodies += 1;
        summary.set(member.crewId, current);
      }
      const crews: CrewClothingCrew[] = crewRows.map((crew) => {
        const totals = summary.get(crew.id) ?? { members: 0, tshirts: 0, hoodies: 0 };
        return {
          id: crew.id, name: crew.name, tshirtMax: crew.tshirtMax, hoodieMax: crew.hoodieMax,
          membersTotal: totals.members, tshirtDeliveredTotal: totals.tshirts, hoodieDeliveredTotal: totals.hoodies,
        };
      });
      return {
        canManageCrews,
        crews,
        members: memberRows.slice(0, 200).map((member) => toMember(member, member.crewId ? crewsById.get(member.crewId)?.name ?? null : null)),
        inventory: inventoryRows.map(toInventory),
        sizeOptions: SHOP_SIZE_OPTIONS,
      };
    },

    async lookup(query) {
      const lookup = query.trim();
      if (!lookup) throw new CrewClothingDomainError("Scan badge eller skriv inn Wannabe ID.", "CONFLICT");
      let profile: Awaited<ReturnType<CrewDirectoryService["lookup"]>>;
      try { profile = await crewDirectory.lookup(lookup); }
      catch { throw new CrewClothingDomainError("Fant ikke crewmedlem for dette oppslaget.", "NOT_FOUND"); }
      return database.db.transaction(async (tx) => {
        const badgeScanNumber = /^\d+$/.test(lookup) ? null : lookup.slice(0, 120);
        let existing = (await tx.select().from(crewClothingMembers).where(eq(crewClothingMembers.wannabeId, profile.id)).limit(1))[0];
        if (!existing && badgeScanNumber) existing = (await tx.select().from(crewClothingMembers).where(eq(crewClothingMembers.badgeScanNumber, badgeScanNumber)).limit(1))[0];
        const crewId = profile.crewName.trim()
          ? await resolveCrew(tx, profile.crewName)
          : existing?.crewId ?? null;
        const now = new Date();
        const values = {
          crewId,
          wannabeId: profile.id > 0 ? profile.id : existing?.wannabeId ?? null,
          badgeScanNumber: badgeScanNumber || existing?.badgeScanNumber || null,
          name: plainText(profile.name || profile.displayName, 180) || (profile.id > 0 ? `Wannabe ${profile.id}` : "Ukjent crewmedlem"),
          nickname: nullableText(profile.nickname, 120) ?? existing?.nickname ?? null,
          updatedAt: now,
        };
        let memberId: number;
        if (existing) {
          memberId = existing.id;
          await tx.update(crewClothingMembers).set(values).where(eq(crewClothingMembers.id, existing.id));
        } else {
          const [created] = await tx.insert(crewClothingMembers).values({
            ...values,
            tshirtSize: null, tshirtDelivered: false, tshirtDeliveredAt: null, tshirtDeliveredByUserId: null,
            hoodieSize: null, hoodieDelivered: false, hoodieDeliveredAt: null, hoodieDeliveredByUserId: null,
            createdAt: now,
          }).$returningId();
          if (!created) throw new Error("Crewmedlemmet kunne ikke opprettes.");
          memberId = created.id;
        }
        const [member] = await tx.select().from(crewClothingMembers).where(eq(crewClothingMembers.id, memberId)).limit(1);
        if (!member) throw new Error("Crewmedlemmet kunne ikke lastes.");
        const crewName = member.crewId ? (await tx.select({ name: crewClothingCrews.name }).from(crewClothingCrews).where(eq(crewClothingCrews.id, member.crewId)).limit(1))[0]?.name ?? null : null;
        return toMember(member, crewName);
      });
    },

    async createCrew(input, actorUserId) {
      return database.db.transaction(async (tx) => {
        const name = plainText(input.name, 120);
        if (!name) throw new CrewClothingDomainError("Crew-navn er påkrevd.", "CONFLICT");
        const [duplicate] = await tx.select({ id: crewClothingCrews.id }).from(crewClothingCrews).where(eq(crewClothingCrews.name, name)).limit(1);
        if (duplicate) throw new CrewClothingDomainError("Crew finnes allerede.", "CONFLICT");
        const now = new Date();
        const [created] = await tx.insert(crewClothingCrews).values({ name, tshirtMax: input.tshirtMax, hoodieMax: input.hoodieMax, createdAt: now, updatedAt: now }).$returningId();
        if (!created) throw new Error("Crewet kunne ikke opprettes.");
        await writeAudit(tx, actorUserId, "create", "crew_clothing_crew", created.id, { name });
        return { id: created.id };
      });
    },

    async updateCrew(id, input, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [existing] = await tx.select().from(crewClothingCrews).where(eq(crewClothingCrews.id, id)).limit(1).for("update");
        if (!existing) throw new CrewClothingDomainError("Crew finnes ikke.", "NOT_FOUND");
        const name = plainText(input.name, 120);
        if (!name) throw new CrewClothingDomainError("Crew-navn er påkrevd.", "CONFLICT");
        const [duplicate] = await tx.select({ id: crewClothingCrews.id }).from(crewClothingCrews).where(eq(crewClothingCrews.name, name)).limit(1);
        if (duplicate && duplicate.id !== id) throw new CrewClothingDomainError("Et annet crew bruker allerede dette navnet.", "CONFLICT");
        const values = { name, tshirtMax: input.tshirtMax, hoodieMax: input.hoodieMax, updatedAt: new Date() };
        await tx.update(crewClothingCrews).set(values).where(eq(crewClothingCrews.id, id));
        await writeAudit(tx, actorUserId, "update", "crew_clothing_crew", id, { name, tshirt_max: input.tshirtMax, hoodie_max: input.hoodieMax });
      });
    },

    async updateMember(id, input, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [member] = await tx.select().from(crewClothingMembers).where(eq(crewClothingMembers.id, id)).limit(1).for("update");
        if (!member) throw new CrewClothingDomainError("Crewmedlem finnes ikke.", "NOT_FOUND");
        const crewId = input.crewId && input.crewId > 0 ? input.crewId : null;
        if (crewId && !(await tx.select({ id: crewClothingCrews.id }).from(crewClothingCrews).where(eq(crewClothingCrews.id, crewId)).limit(1))[0]) {
          throw new CrewClothingDomainError("Valgt crew finnes ikke.", "NOT_FOUND");
        }
        const values = { crewId, tshirtSize: normalizeSize(input.tshirtSize), hoodieSize: normalizeSize(input.hoodieSize), updatedAt: new Date() };
        await tx.update(crewClothingMembers).set(values).where(eq(crewClothingMembers.id, id));
        await writeAudit(tx, actorUserId, "update", "crew_clothing_member", id, { crew_id: crewId, tshirt_size: values.tshirtSize, hoodie_size: values.hoodieSize });
      });
    },

    async setDelivered(id, itemTypes, delivered, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [member] = await tx.select().from(crewClothingMembers).where(eq(crewClothingMembers.id, id)).limit(1).for("update");
        if (!member) throw new CrewClothingDomainError("Crewmedlem finnes ikke.", "NOT_FOUND");
        const uniqueTypes = [...new Set(itemTypes)];
        if (!uniqueTypes.length) throw new CrewClothingDomainError("Velg minst én plaggtype.", "CONFLICT");
        if (delivered) {
          if (uniqueTypes.includes("tshirt") && !member.tshirtSize) throw new CrewClothingDomainError("Velg T-skjorte-størrelse før utlevering registreres.", "CONFLICT");
          if (uniqueTypes.includes("hoodie") && !member.hoodieSize) throw new CrewClothingDomainError("Velg genserstørrelse før utlevering registreres.", "CONFLICT");
        }
        const now = new Date();
        const values: Partial<MemberRow> = { updatedAt: now };
        if (uniqueTypes.includes("tshirt")) {
          values.tshirtDelivered = delivered; values.tshirtDeliveredAt = delivered ? now : null; values.tshirtDeliveredByUserId = delivered ? actorUserId : null;
        }
        if (uniqueTypes.includes("hoodie")) {
          values.hoodieDelivered = delivered; values.hoodieDeliveredAt = delivered ? now : null; values.hoodieDeliveredByUserId = delivered ? actorUserId : null;
        }
        await tx.update(crewClothingMembers).set(values).where(eq(crewClothingMembers.id, id));
        for (const itemType of uniqueTypes) await writeAudit(tx, actorUserId, delivered ? "deliver" : "undo_deliver", "crew_clothing_member", id, { item_type: itemType, delivered: delivered ? 1 : 0 });
      });
    },

    async saveInventory(input, actorUserId) {
      return database.db.transaction(async (tx) => {
        const size = normalizeRequiredSize(input.size);
        const [existing] = await tx.select().from(crewClothingInventory)
          .where(and(eq(crewClothingInventory.itemType, input.itemType), eq(crewClothingInventory.size, size))).limit(1);
        const now = new Date();
        if (existing) {
          await tx.update(crewClothingInventory).set({ quantity: input.quantity, updatedAt: now }).where(eq(crewClothingInventory.id, existing.id));
          await writeAudit(tx, actorUserId, "update", "crew_clothing_inventory", existing.id, { item_type: input.itemType, size, quantity: input.quantity });
          return { id: existing.id };
        }
        const [created] = await tx.insert(crewClothingInventory).values({ itemType: input.itemType, size, quantity: input.quantity, createdAt: now, updatedAt: now }).$returningId();
        if (!created) throw new Error("Varelinjen kunne ikke opprettes.");
        await writeAudit(tx, actorUserId, "create", "crew_clothing_inventory", created.id, { item_type: input.itemType, size, quantity: input.quantity });
        return { id: created.id };
      });
    },

    async updateInventory(id, input, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [existing] = await tx.select().from(crewClothingInventory).where(eq(crewClothingInventory.id, id)).limit(1).for("update");
        if (!existing) throw new CrewClothingDomainError("Varelinjen finnes ikke.", "NOT_FOUND");
        const size = normalizeRequiredSize(input.size);
        const duplicates = await tx.select({ id: crewClothingInventory.id, size: crewClothingInventory.size }).from(crewClothingInventory).where(eq(crewClothingInventory.itemType, input.itemType));
        if (duplicates.some((row) => row.id !== id && row.size === size)) throw new CrewClothingDomainError("Det finnes allerede en varelinje for denne plaggtypen og størrelsen.", "CONFLICT");
        const values = { itemType: input.itemType, size, quantity: input.quantity, updatedAt: new Date() };
        await tx.update(crewClothingInventory).set(values).where(eq(crewClothingInventory.id, id));
        await writeAudit(tx, actorUserId, "update", "crew_clothing_inventory", id, { item_type: input.itemType, size, quantity: input.quantity });
      });
    },

    async deleteInventory(id, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [existing] = await tx.select().from(crewClothingInventory).where(eq(crewClothingInventory.id, id)).limit(1).for("update");
        if (!existing) throw new CrewClothingDomainError("Varelinjen finnes ikke.", "NOT_FOUND");
        await tx.delete(crewClothingInventory).where(eq(crewClothingInventory.id, id));
        await writeAudit(tx, actorUserId, "delete", "crew_clothing_inventory", id, { item_type: existing.itemType, size: existing.size, quantity: existing.quantity });
      });
    },
  };
}

async function resolveCrew(tx: DatabaseTransaction, inputName: string): Promise<number> {
  const name = plainText(inputName, 120);
  const [existing] = await tx.select({ id: crewClothingCrews.id }).from(crewClothingCrews).where(eq(crewClothingCrews.name, name)).limit(1);
  if (existing) return existing.id;
  const now = new Date();
  const [created] = await tx.insert(crewClothingCrews).values({ name, tshirtMax: 1, hoodieMax: 1, createdAt: now, updatedAt: now }).$returningId();
  if (!created) throw new Error("Crewet fra crew-API-et kunne ikke opprettes.");
  return created.id;
}

function toMember(member: MemberRow, crewName: string | null): CrewClothingMember {
  return {
    id: member.id, crewId: member.crewId, crewName, wannabeId: member.wannabeId, badgeScanNumber: member.badgeScanNumber,
    name: member.name, nickname: member.nickname, tshirtSize: member.tshirtSize, tshirtDelivered: member.tshirtDelivered,
    tshirtDeliveredAt: member.tshirtDeliveredAt?.toISOString() ?? null, tshirtDeliveredByUserId: member.tshirtDeliveredByUserId,
    hoodieSize: member.hoodieSize, hoodieDelivered: member.hoodieDelivered, hoodieDeliveredAt: member.hoodieDeliveredAt?.toISOString() ?? null,
    hoodieDeliveredByUserId: member.hoodieDeliveredByUserId, createdAt: member.createdAt.toISOString(), updatedAt: member.updatedAt.toISOString(),
  };
}

function toInventory(item: typeof crewClothingInventory.$inferSelect): CrewClothingInventoryItem {
  return { id: item.id, itemType: item.itemType === "hoodie" ? "hoodie" : "tshirt", size: item.size as ShopSize, quantity: item.quantity, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
}

function normalizeSize(value?: string | null): ShopSize | null { const size = plainText(value ?? "", 20).toUpperCase(); return size ? normalizeRequiredSize(size) : null; }
function normalizeRequiredSize(value: string): ShopSize { const size = plainText(value, 20).toUpperCase(); if (!(SHOP_SIZE_OPTIONS as readonly string[]).includes(size)) throw new CrewClothingDomainError("Ugyldig størrelse.", "CONFLICT"); return size as ShopSize; }
function plainText(value: string, limit: number): string { return value.replace(/<[^>]*>/g, "").trim().slice(0, limit); }
function nullableText(value: string | null | undefined, limit: number): string | null { const text = plainText(value ?? "", limit); return text || null; }
async function writeAudit(tx: DatabaseTransaction, actorUserId: number, action: string, entityType: string, entityId: number, diff: unknown): Promise<void> { await tx.insert(auditLogs).values({ actorUserId, action, entityType, entityId, diffJson: diff, createdAt: new Date() }); }
