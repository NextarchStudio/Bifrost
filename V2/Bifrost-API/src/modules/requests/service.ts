import type {
  CurrentUser,
  EquipmentRequest,
  EquipmentRequestStatus,
  EquipmentRequestWorkspaceResponse,
} from "@bifrost/contracts";
import {
  auditLogs,
  equipment,
  equipmentLoans,
  equipmentRequestItems,
  equipmentRequests,
  locations,
  pallets,
  palletSlots,
  privateEquipmentPrefixes,
  users,
  type DatabaseConnection,
} from "@bifrost/database";
import { and, asc, count, desc, eq, inArray, notInArray, type SQL } from "drizzle-orm";
import { LOGISTICS_ROLES } from "../../http/authorization.js";
import { privateEquipmentNoticeForBarcode } from "../loans/service.js";

export interface EquipmentRequestCreateInput {
  items: Array<{ equipmentId: number; quantity: number; note?: string }>;
}

export interface EquipmentRequestApprovalInput {
  approveAll: boolean;
  decisions: Array<{
    itemId: number;
    approvedQuantity: number;
    rejected: boolean;
    privateEquipmentConfirmed?: boolean;
  }>;
}

export class EquipmentRequestDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT" | "FORBIDDEN") { super(message); }
}

export interface EquipmentRequestService {
  workspace(user: CurrentUser): Promise<EquipmentRequestWorkspaceResponse>;
  create(input: EquipmentRequestCreateInput, user: CurrentUser): Promise<{ id: number }>;
  delete(id: number, user: CurrentUser): Promise<void>;
  updateStatus(id: number, status: "pending" | "rejected" | "fulfilled", user: CurrentUser): Promise<void>;
  approve(id: number, input: EquipmentRequestApprovalInput, user: CurrentUser): Promise<void>;
}

export function createEquipmentRequestService(database: DatabaseConnection): EquipmentRequestService {
  return {
    async workspace(user) {
      const canManage = hasManagerRole(user);
      const canCreate = mayCreateRequest(user);
      const selection = canCreate ? await database.db.select({
        id: equipment.id,
        name: equipment.name,
        serialNumber: equipment.serialNumber,
        quantity: equipment.quantity,
        status: equipment.status,
        locationName: locations.name,
      }).from(equipment)
        .leftJoin(palletSlots, eq(palletSlots.id, equipment.palletSlotId))
        .leftJoin(pallets, eq(pallets.id, palletSlots.palletId))
        .leftJoin(locations, eq(locations.id, pallets.locationId))
        .where(notInArray(equipment.status, ["maintenance"]))
        .orderBy(asc(equipment.name), asc(equipment.serialNumber)) : [];
      const mine = await loadRequests(database, eq(equipmentRequests.requesterUserId, user.id));
      const incoming = canManage
        ? await loadRequests(database, notInArray(equipmentRequests.status, ["rejected", "fulfilled", "returned"]))
        : [];
      return { canCreate, canManage, currentWannabeId: user.wannabeId, selection, mine, incoming };
    },

    async create(input, user) {
      if (!mayCreateRequest(user)) {
        throw new EquipmentRequestDomainError("Denne rollen kan ikke opprette nye utstyrsforespørsler.", "FORBIDDEN");
      }
      if (!user.wannabeId || user.wannabeId < 1) {
        throw new EquipmentRequestDomainError("Du mangler Wannabe-ID på brukerprofilen. Kontakt administrator.", "CONFLICT");
      }
      const wannabeId = user.wannabeId;
      const uniqueItems = [...new Map(input.items.map((item) => [item.equipmentId, item])).values()];
      return database.db.transaction(async (tx) => {
        const availableItems = await tx.select({ id: equipment.id, quantity: equipment.quantity, status: equipment.status })
          .from(equipment).where(inArray(equipment.id, uniqueItems.map((item) => item.equipmentId))).for("update");
        const equipmentById = new Map(availableItems.map((item) => [item.id, item]));
        for (const requested of uniqueItems) {
          const item = equipmentById.get(requested.equipmentId);
          if (!item || item.status === "maintenance" || item.quantity < 1) {
            throw new EquipmentRequestDomainError(`Utstyr ${requested.equipmentId} er ikke tilgjengelig for forespørsel.`, "CONFLICT");
          }
        }
        const now = new Date();
        const [created] = await tx.insert(equipmentRequests).values({
          requesterUserId: user.id,
          wannabeId,
          title: `Utstyrsforespørsel #${wannabeId} (${now.toLocaleString("nb-NO")})`.slice(0, 150),
          notes: null,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        }).$returningId();
        if (!created) throw new Error("Forespørselen kunne ikke opprettes.");
        await tx.insert(equipmentRequestItems).values(uniqueItems.map((item) => ({
          requestId: created.id,
          equipmentId: item.equipmentId,
          quantity: item.quantity,
          approvedQuantity: 0,
          itemStatus: "pending",
          note: item.note?.trim().slice(0, 255) || null,
        })));
        await tx.insert(auditLogs).values({
          actorUserId: user.id,
          action: "create",
          entityType: "equipment_request",
          entityId: created.id,
          diffJson: { items: uniqueItems },
          createdAt: now,
        });
        return { id: created.id };
      });
    },

    async delete(id, user) {
      await database.db.transaction(async (tx) => {
        const [request] = await tx.select({
          requesterUserId: equipmentRequests.requesterUserId,
          status: equipmentRequests.status,
        }).from(equipmentRequests).where(eq(equipmentRequests.id, id)).limit(1).for("update");
        if (!request) throw new EquipmentRequestDomainError("Forespørselen finnes ikke.", "NOT_FOUND");
        const canManage = hasManagerRole(user);
        if (!canManage && request.requesterUserId !== user.id) {
          throw new EquipmentRequestDomainError("Du kan ikke slette denne forespørselen.", "FORBIDDEN");
        }
        if (!canManage && !["pending", "rejected", "returned"].includes(request.status)) {
          throw new EquipmentRequestDomainError("Du kan bare slette egne forespørsler som er ventende, avvist eller returnert.", "CONFLICT");
        }
        const [activeLoans] = await tx.select({ value: count() }).from(equipmentLoans)
          .where(and(eq(equipmentLoans.requestId, id), eq(equipmentLoans.status, "active")));
        if ((activeLoans?.value ?? 0) > 0) {
          throw new EquipmentRequestDomainError("Forespørselen kan ikke slettes mens det finnes aktive utlån knyttet til den.", "CONFLICT");
        }
        await tx.delete(equipmentRequestItems).where(eq(equipmentRequestItems.requestId, id));
        await tx.delete(equipmentRequests).where(eq(equipmentRequests.id, id));
        await tx.insert(auditLogs).values({
          actorUserId: user.id,
          action: "delete",
          entityType: "equipment_request",
          entityId: id,
          diffJson: { status: request.status, requester_user_id: request.requesterUserId },
          createdAt: new Date(),
        });
      });
    },

    async updateStatus(id, status, user) {
      requireManager(user);
      await database.db.transaction(async (tx) => {
        const [request] = await tx.select({ status: equipmentRequests.status }).from(equipmentRequests)
          .where(eq(equipmentRequests.id, id)).limit(1).for("update");
        if (!request) throw new EquipmentRequestDomainError("Forespørselen finnes ikke.", "NOT_FOUND");
        if (request.status === "returned") throw new EquipmentRequestDomainError("En returnert forespørsel kan ikke endre status.", "CONFLICT");
        await tx.update(equipmentRequests).set({ status, updatedAt: new Date() }).where(eq(equipmentRequests.id, id));
        await tx.insert(auditLogs).values({ actorUserId: user.id, action: "status", entityType: "equipment_request", entityId: id, diffJson: { status }, createdAt: new Date() });
      });
    },

    async approve(id, input, user) {
      requireManager(user);
      await database.db.transaction(async (tx) => {
        const [request] = await tx.select({ wannabeId: equipmentRequests.wannabeId, status: equipmentRequests.status })
          .from(equipmentRequests).where(eq(equipmentRequests.id, id)).limit(1).for("update");
        if (!request) throw new EquipmentRequestDomainError("Forespørselen finnes ikke.", "NOT_FOUND");
        if (["fulfilled", "returned", "rejected"].includes(request.status)) {
          throw new EquipmentRequestDomainError("Forespørselen kan ikke godkjennes i nåværende status.", "CONFLICT");
        }
        const items = await tx.select({
          id: equipmentRequestItems.id,
          equipmentId: equipmentRequestItems.equipmentId,
          quantity: equipmentRequestItems.quantity,
          approvedQuantity: equipmentRequestItems.approvedQuantity,
          itemStatus: equipmentRequestItems.itemStatus,
        }).from(equipmentRequestItems).where(eq(equipmentRequestItems.requestId, id)).orderBy(asc(equipmentRequestItems.id)).for("update");
        if (items.length === 0) throw new EquipmentRequestDomainError("Forespørselen har ingen linjer.", "CONFLICT");

        const decisions = new Map(input.decisions.map((decision) => [decision.itemId, decision]));
        const privateRules = await tx.select({ ownerName: privateEquipmentPrefixes.ownerName, barcodePrefix: privateEquipmentPrefixes.barcodePrefix })
          .from(privateEquipmentPrefixes).orderBy(asc(privateEquipmentPrefixes.barcodePrefix));
        const finalStatuses: string[] = [];

        for (const item of items) {
          const decision = input.approveAll
            ? { itemId: item.id, approvedQuantity: item.quantity, rejected: false, privateEquipmentConfirmed: decisions.get(item.id)?.privateEquipmentConfirmed }
            : decisions.get(item.id);
          if (!decision) { finalStatuses.push(item.itemStatus); continue; }
          const targetApproved = Math.min(item.quantity, Math.max(0, decision.approvedQuantity));
          let approvedQuantity = item.approvedQuantity;
          if (targetApproved > approvedQuantity) {
            const [stock] = await tx.select({ quantity: equipment.quantity, status: equipment.status, serialNumber: equipment.serialNumber })
              .from(equipment).where(eq(equipment.id, item.equipmentId)).limit(1).for("update");
            if (!stock) throw new EquipmentRequestDomainError("Tilknyttet utstyr finnes ikke.", "NOT_FOUND");
            const delta = Math.min(Math.max(0, stock.quantity), targetApproved - approvedQuantity);
            const privateNotice = privateEquipmentNoticeForBarcode(privateRules, stock.serialNumber);
            if (delta > 0 && privateNotice && !decision.privateEquipmentConfirmed) {
              throw new EquipmentRequestDomainError(privateNotice.issueMessage, "CONFLICT");
            }
            if (delta > 0) {
              approvedQuantity += delta;
              const remaining = stock.quantity - delta;
              await tx.update(equipment).set({ quantity: remaining, status: remaining > 0 ? "available" : "loaned", updatedAt: new Date() })
                .where(eq(equipment.id, item.equipmentId));
              const [existingLoan] = await tx.select({ id: equipmentLoans.id, quantity: equipmentLoans.quantity }).from(equipmentLoans)
                .where(and(
                  eq(equipmentLoans.requestId, id),
                  eq(equipmentLoans.equipmentId, item.equipmentId),
                  eq(equipmentLoans.wannabeId, request.wannabeId),
                  eq(equipmentLoans.status, "active"),
                )).limit(1).for("update");
              if (existingLoan) {
                await tx.update(equipmentLoans).set({ quantity: existingLoan.quantity + delta }).where(eq(equipmentLoans.id, existingLoan.id));
              } else {
                await tx.insert(equipmentLoans).values({
                  equipmentId: item.equipmentId,
                  wannabeId: request.wannabeId,
                  quantity: delta,
                  requestId: id,
                  issuedByUserId: user.id,
                  issuedAt: new Date(),
                  returnedAt: null,
                  status: "active",
                });
              }
            }
          }
          const itemStatus = approvedQuantity >= item.quantity
            ? "approved"
            : approvedQuantity > 0
              ? "partial"
              : decision.rejected ? "rejected" : "pending";
          await tx.update(equipmentRequestItems).set({ approvedQuantity, itemStatus }).where(eq(equipmentRequestItems.id, item.id));
          finalStatuses.push(itemStatus);
        }

        const requestStatus = requestStatusFromItemStatuses(finalStatuses);
        await tx.update(equipmentRequests).set({ status: requestStatus, updatedAt: new Date() }).where(eq(equipmentRequests.id, id));
        await tx.insert(auditLogs).values({
          actorUserId: user.id,
          action: "approve_partial",
          entityType: "equipment_request",
          entityId: id,
          diffJson: { approve_all: input.approveAll, decisions: input.decisions, result_status: requestStatus },
          createdAt: new Date(),
        });
      });
    },
  };
}

function hasManagerRole(user: CurrentUser): boolean {
  return user.roles.some((role) => LOGISTICS_ROLES.has(role));
}

function mayCreateRequest(user: CurrentUser): boolean {
  return !user.roles.some((role) => LOGISTICS_ROLES.has(role) || role === "sambandsansvarlig");
}

function requireManager(user: CurrentUser): void {
  if (!hasManagerRole(user)) throw new EquipmentRequestDomainError("Du har ikke tilgang til å behandle utstyrsforespørsler.", "FORBIDDEN");
}

export function requestStatusFromItemStatuses(statuses: string[]): EquipmentRequestStatus {
  if (statuses.length > 0 && statuses.every((status) => status === "approved")) return "approved";
  if (statuses.length > 0 && statuses.every((status) => status === "rejected")) return "rejected";
  if (statuses.some((status) => status === "approved" || status === "partial")) return "partial";
  return "pending";
}

async function loadRequests(database: DatabaseConnection, filter: SQL): Promise<EquipmentRequest[]> {
  const rows = await database.db.select({
    id: equipmentRequests.id,
    requesterUserId: equipmentRequests.requesterUserId,
    requesterName: users.name,
    wannabeId: equipmentRequests.wannabeId,
    title: equipmentRequests.title,
    notes: equipmentRequests.notes,
    status: equipmentRequests.status,
    createdAt: equipmentRequests.createdAt,
    updatedAt: equipmentRequests.updatedAt,
  }).from(equipmentRequests)
    .innerJoin(users, eq(users.id, equipmentRequests.requesterUserId))
    .where(filter)
    .orderBy(desc(equipmentRequests.createdAt), desc(equipmentRequests.id));

  return Promise.all(rows.map(async (request) => {
    const items = await database.db.select({
      id: equipmentRequestItems.id,
      equipmentId: equipmentRequestItems.equipmentId,
      equipmentName: equipment.name,
      serialNumber: equipment.serialNumber,
      quantity: equipmentRequestItems.quantity,
      approvedQuantity: equipmentRequestItems.approvedQuantity,
      itemStatus: equipmentRequestItems.itemStatus,
      equipmentQuantity: equipment.quantity,
      equipmentStatus: equipment.status,
      note: equipmentRequestItems.note,
    }).from(equipmentRequestItems)
      .innerJoin(equipment, eq(equipment.id, equipmentRequestItems.equipmentId))
      .where(eq(equipmentRequestItems.requestId, request.id))
      .orderBy(asc(equipmentRequestItems.id));
    const changeRows = items.filter((item) => item.itemStatus !== "pending" && item.approvedQuantity < item.quantity);
    return {
      ...request,
      status: request.status as EquipmentRequestStatus,
      itemsSummary: items.map((item) => `${item.equipmentName} x${item.quantity}`).join(", "),
      changeSummary: changeRows.length > 0 ? changeRows.map((item) => `${item.equipmentName} ${item.approvedQuantity}/${item.quantity}`).join(", ") : null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      items,
    };
  }));
}
