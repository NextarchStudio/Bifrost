import type { AdminStatistics } from "@bifrost/contracts";
import {
  commsItems,
  commsLoanItems,
  commsLoans,
  commsSets,
  crewDirectoryCache,
  equipment,
  equipmentLoans,
  equipmentRequestItems,
  equipmentRequests,
  feedbackEntries,
  locations,
  pallets,
  palletSlots,
  privateEquipmentPrefixes,
  roles,
  shopCategories,
  shopItems,
  shopMovements,
  tasks,
  transportJobs,
  userRoles,
  users,
  vehicleLoans,
  vehicles,
  type DatabaseConnection,
} from "@bifrost/database";
import { and, asc, count, countDistinct, desc, eq, isNotNull, ne, sql } from "drizzle-orm";

type Database = DatabaseConnection["db"];

export async function loadAdminStatistics(database: DatabaseConnection): Promise<AdminStatistics> {
  const [userStats, roleStats, feedbackStats, equipmentStats, commsStats, vehicleStats, requestStats, transportStats, taskStats, shopStats, privateEquipmentStats, locationStats, warehouseStats] = await Promise.all([
    userStatistics(database.db), roleStatistics(database.db), feedbackStatistics(database.db), equipmentStatistics(database.db),
    commsStatistics(database.db), vehicleStatistics(database.db), requestStatistics(database.db), transportStatistics(database.db),
    taskStatistics(database.db), shopStatistics(database.db), privateEquipmentStatistics(database.db), locationStatistics(database.db),
    warehouseStatistics(database.db),
  ]);
  return {
    users: userStats,
    roles: roleStats,
    feedback: feedbackStats,
    equipment: equipmentStats,
    comms: commsStats,
    vehicles: vehicleStats,
    requests: requestStats,
    transport: transportStats,
    tasks: taskStats,
    shop: shopStats,
    privateEquipment: privateEquipmentStats,
    locations: locationStats,
    warehouse: warehouseStats,
  };
}

async function userStatistics(db: Database): Promise<AdminStatistics["users"]> {
  const [total, active, inactive, withWannabeId, withBadgeScan, cached] = await Promise.all([
    db.select({ total: count() }).from(users),
    db.select({ total: count() }).from(users).where(eq(users.active, true)),
    db.select({ total: count() }).from(users).where(eq(users.active, false)),
    db.select({ total: count() }).from(users).where(isNotNull(users.wannabeId)),
    db.select({ total: count() }).from(users).where(isNotNull(users.badgeScanNumber)),
    db.select({ total: count() }).from(crewDirectoryCache),
  ]);
  return { total: value(total), active: value(active), inactive: value(inactive), withWannabeId: value(withWannabeId), withBadgeScan: value(withBadgeScan), cached: value(cached) };
}

async function roleStatistics(db: Database): Promise<AdminStatistics["roles"]> {
  const rows = await db.select({ name: roles.name, displayName: roles.displayName, total: count() })
    .from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId))
    .groupBy(roles.id, roles.name, roles.displayName).orderBy(desc(count()), asc(roles.name));
  return rows.map((row) => ({ name: row.name, displayName: row.displayName?.trim() || row.name, total: number(row.total) }));
}

async function feedbackStatistics(db: Database): Promise<AdminStatistics["feedback"]> {
  const [statusRows, typeRows, totalRows, databaseFixRows] = await Promise.all([
    db.select({ name: feedbackEntries.status, total: count() }).from(feedbackEntries).groupBy(feedbackEntries.status),
    db.select({ name: feedbackEntries.type, total: count() }).from(feedbackEntries).groupBy(feedbackEntries.type),
    db.select({ total: count() }).from(feedbackEntries),
    db.select({ total: count() }).from(feedbackEntries).where(eq(feedbackEntries.needsDatabaseFix, true)),
  ]);
  const status = countMap(statusRows); const type = countMap(typeRows);
  return {
    total: value(totalRows), pending: get(status, "pending"), approved: get(status, "approved"), onHold: get(status, "on_hold"),
    inProgress: get(status, "in_progress"), implemented: get(status, "added"), fixed: get(status, "fixed"),
    completedTotal: get(status, "added") + get(status, "fixed"), rejected: get(status, "rejected"),
    needsDatabaseFix: value(databaseFixRows), featureTotal: get(type, "feature"), bugTotal: get(type, "bug"),
  };
}

async function equipmentStatistics(db: Database): Promise<AdminStatistics["equipment"]> {
  const [statusRows, categoryRows, totalRows, totalQuantityRows, activeLoanRows, activeQuantityRows, returnedLoanRows, returnedQuantityRows, loanEventRows] = await Promise.all([
    db.select({ name: equipment.status, quantity: sql<number>`coalesce(sum(${equipment.quantity}), 0)` }).from(equipment).groupBy(equipment.status),
    db.select({ name: equipment.category, rows: count(), quantity: sql<number>`coalesce(sum(${equipment.quantity}), 0)` }).from(equipment).groupBy(equipment.category).orderBy(desc(sql`sum(${equipment.quantity})`), asc(equipment.category)),
    db.select({ total: count() }).from(equipment),
    db.select({ total: sql<number>`coalesce(sum(${equipment.quantity}), 0)` }).from(equipment),
    db.select({ total: count() }).from(equipmentLoans).where(eq(equipmentLoans.status, "active")),
    db.select({ total: sql<number>`coalesce(sum(${equipmentLoans.quantity}), 0)` }).from(equipmentLoans).where(eq(equipmentLoans.status, "active")),
    db.select({ total: count() }).from(equipmentLoans).where(eq(equipmentLoans.status, "returned")),
    db.select({ total: sql<number>`coalesce(sum(${equipmentLoans.quantity}), 0)` }).from(equipmentLoans).where(eq(equipmentLoans.status, "returned")),
    db.select({ total: count() }).from(equipmentLoans),
  ]);
  const status = quantityMap(statusRows);
  return {
    totalItems: value(totalRows), totalQuantity: value(totalQuantityRows), availableQuantity: get(status, "available"),
    loanedQuantity: get(status, "loaned"), maintenanceQuantity: get(status, "maintenance"), activeLoans: value(activeLoanRows),
    loanedOutQuantity: value(activeQuantityRows), returnedLoans: value(returnedLoanRows), returnedQuantity: value(returnedQuantityRows),
    loanEventsTotal: value(loanEventRows), categories: categoryRows.map((row) => ({ name: row.name || "Ukjent", rows: number(row.rows), quantity: number(row.quantity) })),
  };
}

async function commsStatistics(db: Database): Promise<AdminStatistics["comms"]> {
  const [typeRows, statusRows, totalRows, totalQuantityRows, setRows, activeLoanRows, returnedLoanRows, activeQuantityRows, returnedQuantityRows, loanEventRows] = await Promise.all([
    db.select({ name: commsItems.type, rows: count(), quantity: sql<number>`coalesce(sum(${commsItems.quantity}), 0)` }).from(commsItems).groupBy(commsItems.type).orderBy(desc(sql`sum(${commsItems.quantity})`), asc(commsItems.type)),
    db.select({ name: commsItems.status, quantity: sql<number>`coalesce(sum(${commsItems.quantity}), 0)` }).from(commsItems).groupBy(commsItems.status),
    db.select({ total: count() }).from(commsItems), db.select({ total: sql<number>`coalesce(sum(${commsItems.quantity}), 0)` }).from(commsItems),
    db.select({ total: count() }).from(commsSets), db.select({ total: count() }).from(commsLoans).where(eq(commsLoans.status, "active")),
    db.select({ total: count() }).from(commsLoans).where(eq(commsLoans.status, "returned")),
    loanQuantity(db, "active"), loanQuantity(db, "returned"), db.select({ total: count() }).from(commsLoans),
  ]);
  const status = quantityMap(statusRows);
  return {
    totalItems: value(totalRows), totalQuantity: value(totalQuantityRows), availableQuantity: get(status, "available"), loanedQuantity: get(status, "loaned"),
    totalSets: value(setRows), activeLoans: value(activeLoanRows), returnedLoans: value(returnedLoanRows), loanedOutQuantity: value(activeQuantityRows),
    returnedQuantity: value(returnedQuantityRows), loanEventsTotal: value(loanEventRows),
    types: typeRows.map((row) => ({ name: row.name || "Ukjent", rows: number(row.rows), quantity: number(row.quantity) })),
  };
}

async function loanQuantity(db: Database, status: string) {
  return db.select({ total: sql<number>`coalesce(sum(${commsLoanItems.quantity}), 0)` }).from(commsLoanItems)
    .innerJoin(commsLoans, eq(commsLoans.id, commsLoanItems.loanId)).where(eq(commsLoans.status, status));
}

async function vehicleStatistics(db: Database): Promise<AdminStatistics["vehicles"]> {
  const [statusRows, totalRows, activeRows, returnedRows, eventRows, assignedRows] = await Promise.all([
    db.select({ name: vehicles.status, total: count() }).from(vehicles).groupBy(vehicles.status), db.select({ total: count() }).from(vehicles),
    db.select({ total: count() }).from(vehicleLoans).where(eq(vehicleLoans.status, "active")), db.select({ total: count() }).from(vehicleLoans).where(eq(vehicleLoans.status, "returned")),
    db.select({ total: count() }).from(vehicleLoans), db.select({ total: count() }).from(transportJobs).where(isNotNull(transportJobs.assignedVehicleId)),
  ]);
  const status = countMap(statusRows);
  return { total: value(totalRows), available: get(status, "available"), loaned: get(status, "loaned"), maintenance: get(status, "maintenance"), activeLoans: value(activeRows), returnedLoans: value(returnedRows), loanEventsTotal: value(eventRows), assignedTransportJobs: value(assignedRows) };
}

async function requestStatistics(db: Database): Promise<AdminStatistics["requests"]> {
  const [statusRows, totalRows, quantityRows, lineRows] = await Promise.all([
    db.select({ name: equipmentRequests.status, total: count() }).from(equipmentRequests).groupBy(equipmentRequests.status), db.select({ total: count() }).from(equipmentRequests),
    db.select({ total: sql<number>`coalesce(sum(${equipmentRequestItems.quantity}), 0)` }).from(equipmentRequestItems), db.select({ total: count() }).from(equipmentRequestItems),
  ]);
  const status = countMap(statusRows);
  return { total: value(totalRows), pending: get(status, "pending"), partial: get(status, "partial"), fulfilled: get(status, "fulfilled"), returned: get(status, "returned"), rejected: get(status, "rejected"), requestedQuantity: value(quantityRows), requestLines: value(lineRows) };
}

async function transportStatistics(db: Database): Promise<AdminStatistics["transport"]> {
  const [statusRows, totalRows, peopleRows, equipmentRows] = await Promise.all([
    db.select({ name: transportJobs.status, total: count() }).from(transportJobs).groupBy(transportJobs.status), db.select({ total: count() }).from(transportJobs),
    db.select({ total: count() }).from(transportJobs).where(eq(transportJobs.transportType, "people")), db.select({ total: count() }).from(transportJobs).where(eq(transportJobs.transportType, "equipment")),
  ]);
  const status = countMap(statusRows);
  return { total: value(totalRows), open: get(status, "open"), assigned: get(status, "assigned"), inProgress: get(status, "in_progress"), completed: get(status, "completed"), peopleTransport: value(peopleRows), equipmentTransport: value(equipmentRows) };
}

async function taskStatistics(db: Database): Promise<AdminStatistics["tasks"]> {
  const [statusRows, totalRows, linkedRows] = await Promise.all([
    db.select({ name: tasks.status, total: count() }).from(tasks).groupBy(tasks.status), db.select({ total: count() }).from(tasks),
    db.select({ total: count() }).from(tasks).where(isNotNull(tasks.transportJobId)),
  ]);
  const status = countMap(statusRows);
  return { total: value(totalRows), notStarted: get(status, "not_started"), inProgress: get(status, "in_progress"), blocked: get(status, "blocked"), completed: get(status, "completed"), linkedToTransport: value(linkedRows) };
}

async function shopStatistics(db: Database): Promise<AdminStatistics["shop"]> {
  const [categoryRows, itemRows, quantityRows, movementRows, movementTotalRows] = await Promise.all([
    db.select({ total: count() }).from(shopCategories), db.select({ total: count() }).from(shopItems),
    db.select({ total: sql<number>`coalesce(sum(${shopItems.quantity}), 0)` }).from(shopItems),
    db.select({ name: shopMovements.movementType, rows: count(), quantity: sql<number>`coalesce(sum(${shopMovements.quantity}), 0)` }).from(shopMovements).groupBy(shopMovements.movementType),
    db.select({ total: count() }).from(shopMovements),
  ]);
  const movement = new Map(movementRows.map((row) => [row.name, { rows: number(row.rows), quantity: number(row.quantity) }]));
  return { categories: value(categoryRows), items: value(itemRows), totalQuantity: value(quantityRows), checkoutCount: movement.get("checkout")?.rows ?? 0, checkoutQuantity: movement.get("checkout")?.quantity ?? 0, checkinCount: movement.get("checkin")?.rows ?? 0, checkinQuantity: movement.get("checkin")?.quantity ?? 0, movementsTotal: value(movementTotalRows) };
}

async function privateEquipmentStatistics(db: Database): Promise<AdminStatistics["privateEquipment"]> {
  return { prefixRules: value(await db.select({ total: count() }).from(privateEquipmentPrefixes)) };
}

async function locationStatistics(db: Database): Promise<AdminStatistics["locations"]> {
  const [totalRows, addressRows, typeRows] = await Promise.all([
    db.select({ total: count() }).from(locations),
    db.select({ total: count() }).from(locations).where(and(isNotNull(locations.address), ne(locations.address, ""))),
    db.select({ name: locations.type, total: count() }).from(locations).groupBy(locations.type).orderBy(desc(count())),
  ]);
  return { total: value(totalRows), withAddress: value(addressRows), types: typeRows.map((row) => ({ name: row.name || "Ukjent", total: number(row.total) })) };
}

async function warehouseStatistics(db: Database): Promise<AdminStatistics["warehouse"]> {
  const [palletRows, slotRows, occupiedRows] = await Promise.all([
    db.select({ total: count() }).from(pallets), db.select({ total: count() }).from(palletSlots),
    db.select({ total: countDistinct(equipment.palletSlotId) }).from(equipment).where(isNotNull(equipment.palletSlotId)),
  ]);
  return { pallets: value(palletRows), slots: value(slotRows), occupiedSlots: value(occupiedRows) };
}

function countMap(rows: Array<{ name: string; total: unknown }>): Map<string, number> { return new Map(rows.map((row) => [row.name, number(row.total)])); }
function quantityMap(rows: Array<{ name: string; quantity: unknown }>): Map<string, number> { return new Map(rows.map((row) => [row.name, number(row.quantity)])); }
function value(rows: Array<{ total: unknown }>): number { return number(rows[0]?.total); }
function get(values: Map<string, number>, key: string): number { return values.get(key) ?? 0; }
function number(value: unknown): number { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
