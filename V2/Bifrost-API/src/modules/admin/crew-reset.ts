import type { AdminCrewResetPreview } from "@bifrost/contracts";
import {
  auditLogs,
  authAccounts,
  commsLoans,
  crewDirectoryCache,
  equipmentLoans,
  equipmentRequests,
  feedbackEntries,
  feedbackNotificationReads,
  loginAttempts,
  passwordResetTokens,
  shopMovements,
  systemSettings,
  tasks,
  transportJobs,
  userRoles,
  users,
  vehicleLoans,
  wannabeCompetencies,
  wannabeVehicleKdo,
  type DatabaseConnection,
} from "@bifrost/database";
import { count, eq, ne, or } from "drizzle-orm";

export const CREW_RESET_CONFIRMATION = "SLETT CREW-CACHE OG BRUKERE";
const PRESERVED_USER_ID = 2;

export class CrewResetDomainError extends Error {}

export async function loadCrewResetPreview(database: DatabaseConnection): Promise<AdminCrewResetPreview> {
  const [preservedUserRows, usersRows, crewCacheRows, competencyRows, vehicleKdoRows, passwordResetRows, notificationReadRows, feedbackRows, taskRows, authRows, roleRows, requestRows, equipmentLoanRows, commsLoanRows, vehicleLoanRows, shopMovementRows, auditRows, loginRows, requesterRows, assigneeRows] = await Promise.all([
    database.db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, PRESERVED_USER_ID)).limit(1),
    database.db.select({ total: count() }).from(users).where(ne(users.id, PRESERVED_USER_ID)),
    database.db.select({ total: count() }).from(crewDirectoryCache),
    database.db.select({ total: count() }).from(wannabeCompetencies),
    database.db.select({ total: count() }).from(wannabeVehicleKdo),
    database.db.select({ total: count() }).from(passwordResetTokens).where(ne(passwordResetTokens.userId, PRESERVED_USER_ID)),
    database.db.select({ total: count() }).from(feedbackNotificationReads).where(ne(feedbackNotificationReads.userId, PRESERVED_USER_ID)),
    database.db.select({ total: count() }).from(feedbackEntries).where(ne(feedbackEntries.requesterUserId, PRESERVED_USER_ID)),
    database.db.select({ total: count() }).from(tasks).where(or(ne(tasks.assignedUserId, PRESERVED_USER_ID), ne(tasks.createdByUserId, PRESERVED_USER_ID))),
    database.db.select({ total: count() }).from(authAccounts).where(ne(authAccounts.userId, PRESERVED_USER_ID)),
    database.db.select({ total: count() }).from(userRoles).where(ne(userRoles.userId, PRESERVED_USER_ID)),
    database.db.select({ total: count() }).from(equipmentRequests).where(ne(equipmentRequests.requesterUserId, PRESERVED_USER_ID)),
    database.db.select({ total: count() }).from(equipmentLoans).where(ne(equipmentLoans.issuedByUserId, PRESERVED_USER_ID)),
    database.db.select({ total: count() }).from(commsLoans).where(ne(commsLoans.issuedByUserId, PRESERVED_USER_ID)),
    database.db.select({ total: count() }).from(vehicleLoans).where(ne(vehicleLoans.issuedByUserId, PRESERVED_USER_ID)),
    database.db.select({ total: count() }).from(shopMovements).where(ne(shopMovements.actorUserId, PRESERVED_USER_ID)),
    database.db.select({ total: count() }).from(auditLogs).where(ne(auditLogs.actorUserId, PRESERVED_USER_ID)),
    database.db.select({ total: count() }).from(loginAttempts),
    database.db.select({ total: count() }).from(transportJobs).where(ne(transportJobs.requesterUserId, PRESERVED_USER_ID)),
    database.db.select({ total: count() }).from(transportJobs).where(ne(transportJobs.assignedUserId, PRESERVED_USER_ID)),
  ]);
  const preservedUser = preservedUserRows[0] ?? null;
  return {
    confirmationPhrase: CREW_RESET_CONFIRMATION,
    preservedUser,
    deletes: {
      users: value(usersRows), crewCache: value(crewCacheRows), competencies: value(competencyRows), vehicleKdo: value(vehicleKdoRows),
      passwordResetTokens: value(passwordResetRows), feedbackNotificationReads: value(notificationReadRows), feedbackEntries: value(feedbackRows),
      tasks: value(taskRows), authAccounts: value(authRows), userRoles: value(roleRows), equipmentRequests: value(requestRows),
      equipmentLoans: value(equipmentLoanRows), commsLoans: value(commsLoanRows), vehicleLoans: value(vehicleLoanRows),
      shopMovements: value(shopMovementRows), auditLogs: value(auditRows), loginAttempts: value(loginRows),
    },
    unlinks: { transportRequesters: value(requesterRows), transportAssignees: value(assigneeRows) },
    clearsProtectedUserBadge: Boolean(preservedUser),
    cacheYear: new Date().getFullYear(),
  };
}

export async function resetCrewData(database: DatabaseConnection, confirmation: string, actorUserId: number): Promise<AdminCrewResetPreview> {
  if (confirmation !== CREW_RESET_CONFIRMATION) throw new CrewResetDomainError("Bekreftelsesfrasen er ikke korrekt.");
  const preview = await loadCrewResetPreview(database);
  if (!preview.preservedUser) throw new CrewResetDomainError(`Beskyttet bruker-ID ${PRESERVED_USER_ID} finnes ikke. Reset er blokkert.`);
  await database.db.transaction(async (tx) => {
    const [protectedUser] = await tx.select({ id: users.id }).from(users).where(eq(users.id, PRESERVED_USER_ID)).limit(1).for("update");
    if (!protectedUser) throw new CrewResetDomainError(`Beskyttet bruker-ID ${PRESERVED_USER_ID} finnes ikke. Reset er blokkert.`);

    await tx.delete(crewDirectoryCache);
    await tx.delete(wannabeCompetencies);
    await tx.delete(wannabeVehicleKdo);
    await tx.delete(passwordResetTokens).where(ne(passwordResetTokens.userId, PRESERVED_USER_ID));
    await tx.delete(feedbackNotificationReads).where(ne(feedbackNotificationReads.userId, PRESERVED_USER_ID));
    await tx.delete(feedbackEntries).where(ne(feedbackEntries.requesterUserId, PRESERVED_USER_ID));
    await tx.delete(tasks).where(ne(tasks.assignedUserId, PRESERVED_USER_ID));
    await tx.delete(tasks).where(ne(tasks.createdByUserId, PRESERVED_USER_ID));
    await tx.delete(authAccounts).where(ne(authAccounts.userId, PRESERVED_USER_ID));
    await tx.delete(userRoles).where(ne(userRoles.userId, PRESERVED_USER_ID));
    await tx.delete(equipmentRequests).where(ne(equipmentRequests.requesterUserId, PRESERVED_USER_ID));
    await tx.delete(equipmentLoans).where(ne(equipmentLoans.issuedByUserId, PRESERVED_USER_ID));
    await tx.delete(commsLoans).where(ne(commsLoans.issuedByUserId, PRESERVED_USER_ID));
    await tx.delete(vehicleLoans).where(ne(vehicleLoans.issuedByUserId, PRESERVED_USER_ID));
    await tx.delete(shopMovements).where(ne(shopMovements.actorUserId, PRESERVED_USER_ID));
    await tx.delete(auditLogs).where(ne(auditLogs.actorUserId, PRESERVED_USER_ID));
    await tx.delete(loginAttempts);
    await tx.update(transportJobs).set({ requesterUserId: null }).where(ne(transportJobs.requesterUserId, PRESERVED_USER_ID));
    await tx.update(transportJobs).set({ assignedUserId: null }).where(ne(transportJobs.assignedUserId, PRESERVED_USER_ID));
    await tx.delete(users).where(ne(users.id, PRESERVED_USER_ID));
    await tx.update(users).set({ badgeScanNumber: null, updatedAt: new Date() }).where(eq(users.id, PRESERVED_USER_ID));
    await tx.update(systemSettings).set({ crewCacheYear: preview.cacheYear }).where(eq(systemSettings.id, 1));
    await tx.insert(auditLogs).values({
      actorUserId: PRESERVED_USER_ID,
      action: "clear_cache",
      entityType: "crew_directory_cache",
      entityId: 1,
      diffJson: { year: preview.cacheYear, actor_user_id: actorUserId, preserved_user_id: PRESERVED_USER_ID, preview },
      createdAt: new Date(),
    });
  });
  return preview;
}

function value(rows: Array<{ total: unknown }>): number { const parsed = Number(rows[0]?.total ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
