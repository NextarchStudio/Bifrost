import type { EquipmentLoanIssueResponse, EquipmentLoanListResponse, EquipmentLoanReturnResponse } from "@bifrost/contracts";
import { auditLogs, equipment, equipmentLoans, equipmentRequests, users, type DatabaseConnection } from "@bifrost/database";
import { and, count, desc, eq, like, or, sql, type SQL } from "drizzle-orm";

export interface LoanListQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export interface LoanIssueInput {
  wannabeId: number;
  lines: Array<{ barcode: string; quantity: number }>;
}

export class LoanDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT") { super(message); }
}

export interface LoanService {
  listActive(query: LoanListQuery): Promise<EquipmentLoanListResponse>;
  issue(input: LoanIssueInput, actorUserId: number): Promise<EquipmentLoanIssueResponse>;
  returnLoan(id: number, quantity: number, actorUserId: number): Promise<EquipmentLoanReturnResponse>;
}

export function createLoanService(database: DatabaseConnection): LoanService {
  return {
    async listActive(query) {
      const filters: SQL[] = [eq(equipmentLoans.status, "active")];
      if (query.search) {
        const search = `%${query.search}%`;
        filters.push(or(
          like(equipment.serialNumber, search),
          like(equipment.name, search),
          like(users.name, search),
          sql`cast(${equipmentLoans.wannabeId} as char) like ${search}`,
        )!);
      }
      const where = and(...filters);
      const [totalRow] = await database.db.select({ value: count() }).from(equipmentLoans)
        .innerJoin(equipment, eq(equipment.id, equipmentLoans.equipmentId))
        .leftJoin(users, eq(users.wannabeId, equipmentLoans.wannabeId))
        .where(where);
      const total = totalRow?.value ?? 0;
      const rows = await database.db.select({
        id: equipmentLoans.id,
        equipmentId: equipmentLoans.equipmentId,
        equipmentName: equipment.name,
        serialNumber: equipment.serialNumber,
        wannabeId: equipmentLoans.wannabeId,
        borrowerName: users.name,
        quantity: equipmentLoans.quantity,
        requestId: equipmentLoans.requestId,
        issuedByUserId: equipmentLoans.issuedByUserId,
        issuedAt: equipmentLoans.issuedAt,
        status: equipmentLoans.status,
      }).from(equipmentLoans)
        .innerJoin(equipment, eq(equipment.id, equipmentLoans.equipmentId))
        .leftJoin(users, eq(users.wannabeId, equipmentLoans.wannabeId))
        .where(where)
        .orderBy(desc(equipmentLoans.issuedAt), desc(equipmentLoans.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return {
        items: rows.map((row) => ({ ...row, issuedAt: row.issuedAt.toISOString() })),
        pagination: { page: query.page, pageSize: query.pageSize, total, pageCount: Math.ceil(total / query.pageSize) },
      };
    },

    async issue(input, actorUserId) {
      return database.db.transaction(async (tx) => {
        const loanIds: number[] = [];
        for (const line of input.lines) {
          const [item] = await tx.select({
            id: equipment.id,
            quantity: equipment.quantity,
            status: equipment.status,
          }).from(equipment).where(eq(equipment.serialNumber, line.barcode)).limit(1).for("update");
          if (!item) throw new LoanDomainError(`Ugyldig strekkode/serienummer: ${line.barcode}.`, "NOT_FOUND");
          if (item.status === "maintenance" || item.quantity < 1) {
            throw new LoanDomainError(`Utstyret med strekkode ${line.barcode} er ikke tilgjengelig på lager.`, "CONFLICT");
          }
          if (line.quantity > item.quantity) {
            throw new LoanDomainError(`Det finnes ikke nok antall tilgjengelig på lager for strekkode ${line.barcode}.`, "CONFLICT");
          }

          const [existing] = await tx.select({ id: equipmentLoans.id, quantity: equipmentLoans.quantity })
            .from(equipmentLoans).where(and(
              eq(equipmentLoans.equipmentId, item.id),
              eq(equipmentLoans.wannabeId, input.wannabeId),
              eq(equipmentLoans.status, "active"),
            )).limit(1).for("update");

          let loanId: number;
          if (existing) {
            loanId = existing.id;
            await tx.update(equipmentLoans).set({ quantity: existing.quantity + line.quantity }).where(eq(equipmentLoans.id, loanId));
          } else {
            const [created] = await tx.insert(equipmentLoans).values({
              equipmentId: item.id,
              wannabeId: input.wannabeId,
              quantity: line.quantity,
              requestId: null,
              issuedByUserId: actorUserId,
              issuedAt: new Date(),
              returnedAt: null,
              status: "active",
            }).$returningId();
            if (!created) throw new Error("Lånet kunne ikke opprettes.");
            loanId = created.id;
          }

          const remaining = item.quantity - line.quantity;
          await tx.update(equipment).set({
            quantity: remaining,
            status: remaining > 0 ? "available" : "loaned",
            updatedAt: new Date(),
          }).where(eq(equipment.id, item.id));
          await writeAudit(tx, actorUserId, "issue", "equipment_loan", loanId, {
            barcode: line.barcode,
            wannabe_id: input.wannabeId,
            quantity: line.quantity,
          });
          loanIds.push(loanId);
        }
        return { loanIds: [...new Set(loanIds)] };
      });
    },

    async returnLoan(id, returnQuantity, actorUserId) {
      return database.db.transaction(async (tx) => {
        const [loan] = await tx.select({
          id: equipmentLoans.id,
          equipmentId: equipmentLoans.equipmentId,
          quantity: equipmentLoans.quantity,
          requestId: equipmentLoans.requestId,
          status: equipmentLoans.status,
        }).from(equipmentLoans).where(eq(equipmentLoans.id, id)).limit(1).for("update");
        if (!loan) throw new LoanDomainError("Lån ikke funnet.", "NOT_FOUND");
        if (loan.status !== "active") throw new LoanDomainError("Lånet er allerede returnert.", "CONFLICT");
        if (returnQuantity > loan.quantity) throw new LoanDomainError("Du kan ikke returnere flere enn det som er lånt ut.", "CONFLICT");

        const [item] = await tx.select({ quantity: equipment.quantity }).from(equipment)
          .where(eq(equipment.id, loan.equipmentId)).limit(1).for("update");
        if (!item) throw new LoanDomainError("Tilknyttet utstyr finnes ikke.", "NOT_FOUND");
        await tx.update(equipment).set({
          quantity: item.quantity + returnQuantity,
          status: "available",
          updatedAt: new Date(),
        }).where(eq(equipment.id, loan.equipmentId));

        const remaining = loan.quantity - returnQuantity;
        const status = remaining === 0 ? "returned" : "active";
        await tx.update(equipmentLoans).set({
          quantity: remaining,
          status,
          returnedAt: remaining === 0 ? new Date() : null,
        }).where(eq(equipmentLoans.id, id));

        if (loan.requestId) {
          const [request] = await tx.select({ status: equipmentRequests.status }).from(equipmentRequests)
            .where(eq(equipmentRequests.id, loan.requestId)).limit(1);
          if (request?.status === "fulfilled") {
            const [activeLoans] = await tx.select({ value: count() }).from(equipmentLoans)
              .where(and(eq(equipmentLoans.requestId, loan.requestId), eq(equipmentLoans.status, "active")));
            if ((activeLoans?.value ?? 0) === 0) {
              await tx.update(equipmentRequests).set({ status: "returned", updatedAt: new Date() })
                .where(eq(equipmentRequests.id, loan.requestId));
              await writeAudit(tx, actorUserId, "status", "equipment_request", loan.requestId, { status: "returned" });
            }
          }
        }

        await writeAudit(tx, actorUserId, "return", "equipment_loan", id, {
          returned_quantity: returnQuantity,
          remaining_quantity: remaining,
        });
        return { loanId: id, returnedQuantity: returnQuantity, remainingQuantity: remaining, status };
      });
    },
  };
}

type AuditTransaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];

async function writeAudit(tx: AuditTransaction, actorUserId: number, action: string, entityType: string, entityId: number, diffJson: Record<string, unknown>): Promise<void> {
  await tx.insert(auditLogs).values({ actorUserId, action, entityType, entityId, diffJson, createdAt: new Date() });
}
