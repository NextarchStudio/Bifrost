import {
  BIFROST_ACCESS,
  hasAnyBifrostRole,
  isBifrostDenied,
  type CurrentUser,
  type EquipmentRequestStatus,
  type UserProfileResponse,
} from "@bifrost/contracts";
import {
  commsItems,
  commsLoanItems,
  commsLoans,
  commsSets,
  equipment,
  equipmentLoans,
  equipmentRequestItems,
  equipmentRequests,
  roles,
  userRoles,
  users,
  vehicleLoans,
  vehicles,
  type DatabaseConnection,
} from "@bifrost/database";
import { and, desc, eq, ne, sql } from "drizzle-orm";

const PROFILE_VIEW_ROLES = BIFROST_ACCESS.profileView;
const REQUEST_VIEW_ROLES = BIFROST_ACCESS.profileRequestView;

export class ProfileDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "FORBIDDEN") { super(message); }
}

export interface ProfileService {
  profile(viewer: CurrentUser, wannabeId: number): Promise<UserProfileResponse>;
  canShowPicture(wannabeId: number): Promise<boolean>;
}

export function createProfileService(database: DatabaseConnection): ProfileService {
  return {
    async profile(viewer, wannabeId) {
      const [target] = await database.db.select({
        id: users.id,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        wannabeId: users.wannabeId,
      }).from(users).where(eq(users.wannabeId, wannabeId)).limit(1);
      if (!target?.wannabeId) throw new ProfileDomainError("Profilen finnes ikke.", "NOT_FOUND");

      const { isOwnProfile, canViewOtherProfiles, canViewRequests } = profileAccess(viewer, wannabeId);
      if (!isOwnProfile && !canViewOtherProfiles) throw new ProfileDomainError("Du har ikke tilgang til denne profilen.", "FORBIDDEN");

      const targetRoleRows = await roleRows(database, target.id);
      const targetRoles = targetRoleRows.map((row) => row.name);
      const [equipmentLoanRows, vehicleLoanRows, commsLoanRows, requestRows] = await Promise.all([
        database.db.select({
          id: equipmentLoans.id,
          equipmentName: equipment.name,
          serialNumber: equipment.serialNumber,
          quantity: equipmentLoans.quantity,
          status: equipmentLoans.status,
          issuedAt: equipmentLoans.issuedAt,
        }).from(equipmentLoans).innerJoin(equipment, eq(equipment.id, equipmentLoans.equipmentId))
          .where(and(eq(equipmentLoans.wannabeId, wannabeId), eq(equipmentLoans.status, "active")))
          .orderBy(desc(equipmentLoans.issuedAt)),
        database.db.select({
          id: vehicleLoans.id,
          vehicleName: vehicles.name,
          registrationNumber: vehicles.registrationNumber,
          status: vehicleLoans.status,
          issuedAt: vehicleLoans.issuedAt,
        }).from(vehicleLoans).innerJoin(vehicles, eq(vehicles.id, vehicleLoans.vehicleId))
          .where(and(eq(vehicleLoans.wannabeId, wannabeId), eq(vehicleLoans.status, "active")))
          .orderBy(desc(vehicleLoans.issuedAt)),
        database.db.select({
          id: commsLoans.id,
          setId: commsLoans.setId,
          setName: commsSets.name,
          itemsSummary: sql<string>`coalesce(group_concat(concat(${commsItems.name}, ' x', ${commsLoanItems.quantity}) order by ${commsItems.name} separator ', '), '-')`,
          totalItems: sql<number>`coalesce(sum(${commsLoanItems.quantity}), 0)`,
          issuedAt: commsLoans.issuedAt,
        }).from(commsLoans)
          .leftJoin(commsSets, eq(commsSets.id, commsLoans.setId))
          .leftJoin(commsLoanItems, eq(commsLoanItems.loanId, commsLoans.id))
          .leftJoin(commsItems, eq(commsItems.id, commsLoanItems.itemId))
          .where(and(eq(commsLoans.wannabeId, wannabeId), eq(commsLoans.status, "active")))
          .groupBy(commsLoans.id, commsLoans.setId, commsSets.name, commsLoans.issuedAt)
          .orderBy(desc(commsLoans.issuedAt)),
        canViewRequests ? database.db.select({
          id: equipmentRequests.id,
          status: equipmentRequests.status,
          createdAt: equipmentRequests.createdAt,
          itemsSummary: sql<string>`coalesce(group_concat(concat(${equipment.name}, ' x', ${equipmentRequestItems.quantity}) separator ', '), '-')`,
        }).from(equipmentRequests)
          .leftJoin(equipmentRequestItems, eq(equipmentRequestItems.requestId, equipmentRequests.id))
          .leftJoin(equipment, eq(equipment.id, equipmentRequestItems.equipmentId))
          .where(and(eq(equipmentRequests.requesterUserId, target.id), ne(equipmentRequests.status, "returned")))
          .groupBy(equipmentRequests.id, equipmentRequests.status, equipmentRequests.createdAt)
          .orderBy(desc(equipmentRequests.createdAt)) : Promise.resolve([]),
      ]);

      return {
        user: {
          ...target,
          wannabeId: target.wannabeId,
          roles: targetRoles,
          roleDisplayNames: targetRoleRows.map((row) => row.displayName?.trim() || row.name),
        },
        isOwnProfile,
        canViewOtherProfiles,
        canViewRequests,
        pictureAvailable: !isBifrostDenied(targetRoles, "profilePicture"),
        equipmentLoans: equipmentLoanRows.map((row) => ({ ...row, issuedAt: row.issuedAt.toISOString() })),
        vehicleLoans: vehicleLoanRows.map((row) => ({ ...row, issuedAt: row.issuedAt.toISOString() })),
        commsLoans: commsLoanRows.map((row) => ({ ...row, totalItems: Number(row.totalItems), issuedAt: row.issuedAt.toISOString() })),
        requests: requestRows.map((row) => ({ ...row, status: requestStatus(row.status), createdAt: row.createdAt.toISOString() })),
      };
    },

    async canShowPicture(wannabeId) {
      const [target] = await database.db.select({ id: users.id }).from(users).where(eq(users.wannabeId, wannabeId)).limit(1);
      if (!target) return true;
      const targetRoles = await roleRows(database, target.id);
      return !isBifrostDenied(targetRoles.map((role) => role.name), "profilePicture");
    },
  };
}

export function profileAccess(viewer: CurrentUser, targetWannabeId: number) {
  const isOwnProfile = viewer.wannabeId === targetWannabeId;
  const canViewOtherProfiles = hasAnyBifrostRole(viewer.roles, PROFILE_VIEW_ROLES);
  return {
    isOwnProfile,
    canViewOtherProfiles,
    canViewRequests: isOwnProfile || hasAnyBifrostRole(viewer.roles, REQUEST_VIEW_ROLES),
  };
}

async function roleRows(database: DatabaseConnection, userId: number) {
  return database.db.select({ name: roles.name, displayName: roles.displayName })
    .from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId)).orderBy(roles.name);
}

function requestStatus(value: string): EquipmentRequestStatus {
  return value === "approved" || value === "rejected" || value === "partial" || value === "fulfilled" || value === "returned" ? value : "pending";
}
