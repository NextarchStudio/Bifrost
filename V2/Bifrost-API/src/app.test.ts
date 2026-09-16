import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "./app.js";
import { AuthenticationError } from "./modules/auth/service.js";
import type { EquipmentService } from "./modules/equipment/service.js";
import { EquipmentDomainError } from "./modules/equipment/service.js";
import type { LocationService } from "./modules/locations/service.js";
import type { WarehouseService } from "./modules/warehouse/service.js";
import { WarehouseDomainError } from "./modules/warehouse/service.js";
import type { LoanService } from "./modules/loans/service.js";
import { LoanDomainError } from "./modules/loans/service.js";
import type { CrewDirectoryService } from "./modules/crew/service.js";
import { CrewDirectoryError } from "./modules/crew/service.js";
import type { PrivateEquipmentService } from "./modules/private-equipment/service.js";

const locationStub = (overrides: Partial<LocationService> = {}): LocationService => ({
  list: async () => [],
  create: async (input) => ({ id: 1, address: input.address ?? null, ...input }),
  update: async () => undefined,
  delete: async () => undefined,
  ...overrides,
});

const warehouseStub = (overrides: Partial<WarehouseService> = {}): WarehouseService => ({
  listPallets: async () => [],
  inspectPallet: async () => { throw new Error("not called"); },
  createPallet: async (input) => ({ id: 1, locationName: "Lager", ...input }),
  createSlot: async () => ({ id: 1 }),
  addEquipmentByBarcode: async () => undefined,
  movePallet: async () => undefined,
  deletePallet: async () => undefined,
  ...overrides,
});

const loanStub = (overrides: Partial<LoanService> = {}): LoanService => ({
  listActive: async (query) => ({ items: [], pagination: { ...query, total: 0, pageCount: 0 } }),
  issue: async () => ({ loanIds: [1] }),
  returnLoan: async (id, quantity) => ({ loanId: id, returnedQuantity: quantity, remainingQuantity: 0, status: "returned", privateEquipmentNotice: null }),
  ...overrides,
});

const crewStub = (overrides: Partial<CrewDirectoryService> = {}): CrewDirectoryService => ({
  lookup: async () => ({ id: 12345, name: "Crew Member", nickname: "", crewName: "Logistics", role: "Crew", displayName: "Crew Member", source: "cache" }),
  ...overrides,
});

const privateEquipmentStub = (overrides: Partial<PrivateEquipmentService> = {}): PrivateEquipmentService => ({
  list: async () => [],
  listNotices: async () => [],
  create: async (input) => ({
    id: 1,
    ownerName: input.ownerName,
    barcodePrefix: input.barcodePrefix,
    prefix: input.barcodePrefix,
    issueMessage: "Bekreft utlån.",
    returnMessage: "Returner til eier.",
    equipmentCount: 0,
    lowestSerial: null,
    highestSerial: null,
    equipmentItems: [],
  }),
  delete: async () => undefined,
  ...overrides,
});

const equipmentStub = (overrides: Partial<EquipmentService> = {}): EquipmentService => ({
  list: async () => { throw new Error("not called"); },
  create: async () => { throw new Error("not called"); },
  updateDetails: async () => { throw new Error("not called"); },
  updateQuantity: async () => { throw new Error("not called"); },
  updateStatus: async () => { throw new Error("not called"); },
  move: async () => { throw new Error("not called"); },
  delete: async () => { throw new Error("not called"); },
  ...overrides,
});

test("health returns API status", async () => {
  const app = buildApp({ checkDatabase: async () => undefined });
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "ok");
  await app.close();
});

test("ready reports unavailable database", async () => {
  const app = buildApp({ checkDatabase: async () => { throw new Error("offline"); } });
  const response = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().database, "unavailable");
  await app.close();
});

test("publishes OIDC configuration without authentication", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => ({
        authority: "https://id.example.test/realms/bifrost",
        clientId: "bifrost-web",
        redirectUri: "http://localhost:3000/auth/callback",
        scope: "openid profile email",
      }),
      authenticate: async () => { throw new Error("not called"); },
    },
  });
  const response = await app.inject({ method: "GET", url: "/api/v1/auth/config" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().clientId, "bifrost-web");
  await app.close();
});

test("protects current-user endpoint with a bearer token", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => { throw new Error("not called"); },
    },
  });
  const response = await app.inject({ method: "GET", url: "/api/v1/me" });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "UNAUTHORIZED");
  await app.close();
});

test("lists equipment for an authorized logistics user", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({
        id: 1,
        name: "Logistikk Bruker",
        firstName: "Logistikk",
        lastName: "Bruker",
        email: "logistikk@example.test",
        wannabeId: null,
        roles: ["logistikk"],
      }),
    },
    equipment: equipmentStub({
      list: async (query) => ({ items: [], pagination: { ...query, total: 0, pageCount: 0 } }),
      create: async () => ({ id: 1, merged: false }),
    }),
  });
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/equipment?page=2&pageSize=10",
    headers: { authorization: "Bearer valid" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().pagination.page, 2);
  await app.close();
});

test("denies equipment to users without a logistics role", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({
        id: 2,
        name: "Vanlig Bruker",
        firstName: "Vanlig",
        lastName: "Bruker",
        email: "bruker@example.test",
        wannabeId: null,
        roles: ["bruker"],
      }),
    },
    equipment: equipmentStub(),
  });
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/equipment",
    headers: { authorization: "Bearer valid" },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, "FORBIDDEN");
  await app.close();
});

test("preserves an OIDC configuration error on protected routes", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => { throw new AuthenticationError("Keycloak/OIDC er ikke konfigurert.", 503); },
    },
    equipment: equipmentStub(),
  });
  const response = await app.inject({ method: "GET", url: "/api/v1/equipment", headers: { authorization: "Bearer token" } });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "OIDC_NOT_CONFIGURED");
  await app.close();
});

test("creates equipment for an authorized user", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({
        id: 7,
        name: "Lager Bruker",
        firstName: "Lager",
        lastName: "Bruker",
        email: "lager@example.test",
        wannabeId: null,
        roles: ["logistikk"],
      }),
    },
    equipment: equipmentStub({
      create: async (_input, actorUserId) => ({ id: actorUserId, merged: false }),
    }),
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/equipment",
    headers: { authorization: "Bearer valid" },
    payload: { name: "Kabel", category: "Kabel", serialNumber: "KB-100", quantity: 4 },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().id, 7);
  await app.close();
});

test("updates equipment status with actor context", async () => {
  let actor = 0;
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 9, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    equipment: equipmentStub({ updateStatus: async (_id, _status, actorUserId) => { actor = actorUserId; } }),
  });
  const response = await app.inject({ method: "PATCH", url: "/api/v1/equipment/42/status", headers: { authorization: "Bearer valid" }, payload: { status: "maintenance" } });
  assert.equal(response.statusCode, 204);
  assert.equal(actor, 9);
  await app.close();
});

test("returns conflict when equipment cannot be deleted", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 9, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    equipment: equipmentStub({ delete: async () => { throw new EquipmentDomainError("Aktiv kobling.", "CONFLICT"); } }),
  });
  const response = await app.inject({ method: "DELETE", url: "/api/v1/equipment/42", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "CONFLICT");
  await app.close();
});

test("lists equipment categories for logistics users", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 9, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    categories: {
      list: async () => [{ id: 1, name: "Kabel" }],
      create: async (name) => ({ id: 2, name }),
      delete: async () => undefined,
    },
  });
  const response = await app.inject({ method: "GET", url: "/api/v1/equipment-categories", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json()[0].name, "Kabel");
  await app.close();
});

test("creates a location with actor context", async () => {
  let actor = 0;
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 14, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    locations: locationStub({
      create: async (input, actorUserId) => { actor = actorUserId; return { id: 3, address: input.address ?? null, ...input }; },
    }),
  });
  const response = await app.inject({ method: "POST", url: "/api/v1/locations", headers: { authorization: "Bearer valid" }, payload: { name: "Varemottak", type: "Lager", address: "Vikingskipet" } });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().name, "Varemottak");
  assert.equal(actor, 14);
  await app.close();
});

test("rejects an invalid location payload", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 14, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    locations: locationStub(),
  });
  const response = await app.inject({ method: "POST", url: "/api/v1/locations", headers: { authorization: "Bearer valid" }, payload: { name: "", type: "Lager" } });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "INVALID_BODY");
  await app.close();
});

test("creates a pallet with actor context", async () => {
  let actor = 0;
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 18, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    warehouse: warehouseStub({
      createPallet: async (input, actorUserId) => { actor = actorUserId; return { id: 5, locationName: "Varemottak", ...input }; },
    }),
  });
  const response = await app.inject({ method: "POST", url: "/api/v1/pallets", headers: { authorization: "Bearer valid" }, payload: { name: "Palle 12", qrCode: "PAL-12", locationId: 3 } });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().qrCode, "PAL-12");
  assert.equal(actor, 18);
  await app.close();
});

test("returns conflict when a pallet contains equipment", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 18, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    warehouse: warehouseStub({ deletePallet: async () => { throw new WarehouseDomainError("Pallen inneholder utstyr.", "CONFLICT"); } }),
  });
  const response = await app.inject({ method: "DELETE", url: "/api/v1/pallets/5", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "CONFLICT");
  await app.close();
});

test("moves equipment to a pallet by barcode", async () => {
  let scanned = "";
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 18, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    warehouse: warehouseStub({ addEquipmentByBarcode: async (palletQrCode, equipmentBarcode) => { scanned = `${palletQrCode}:${equipmentBarcode}`; } }),
  });
  const response = await app.inject({ method: "POST", url: "/api/v1/pallets/equipment", headers: { authorization: "Bearer valid" }, payload: { palletQrCode: "PAL-12", equipmentBarcode: "EQ-99" } });
  assert.equal(response.statusCode, 204);
  assert.equal(scanned, "PAL-12:EQ-99");
  await app.close();
});

test("issues multiple loan lines atomically through the service", async () => {
  let actor = 0;
  let lineCount = 0;
  let privateEquipmentConfirmed = false;
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 21, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    loans: loanStub({ issue: async (input, actorUserId) => { actor = actorUserId; lineCount = input.lines.length; privateEquipmentConfirmed = input.lines[0]?.privateEquipmentConfirmed ?? false; return { loanIds: [10, 11] }; } }),
  });
  const response = await app.inject({ method: "POST", url: "/api/v1/loans", headers: { authorization: "Bearer valid" }, payload: { wannabeId: 12345, lines: [{ barcode: "EQ-1", quantity: 1, privateEquipmentConfirmed: true }, { barcode: "EQ-2", quantity: 2 }] } });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json().loanIds, [10, 11]);
  assert.equal(actor, 21);
  assert.equal(lineCount, 2);
  assert.equal(privateEquipmentConfirmed, true);
  await app.close();
});

test("requires explicit confirmation when the loan service detects private equipment", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 21, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    loans: loanStub({ issue: async () => { throw new LoanDomainError("Bekreft privat utstyr.", "PRIVATE_EQUIPMENT_CONFIRMATION_REQUIRED"); } }),
  });
  const response = await app.inject({ method: "POST", url: "/api/v1/loans", headers: { authorization: "Bearer valid" }, payload: { wannabeId: 12345, lines: [{ barcode: "PRIVAT-1", quantity: 1 }] } });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "PRIVATE_EQUIPMENT_CONFIRMATION_REQUIRED");
  await app.close();
});

test("rejects returning more equipment than is on the loan", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 21, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    loans: loanStub({ returnLoan: async () => { throw new LoanDomainError("Du kan ikke returnere flere enn det som er lånt ut.", "CONFLICT"); } }),
  });
  const response = await app.inject({ method: "POST", url: "/api/v1/loans/10/return", headers: { authorization: "Bearer valid" }, payload: { quantity: 4 } });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "CONFLICT");
  await app.close();
});

test("looks up a crew profile by badge scan", async () => {
  let lookupQuery = "";
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 21, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    crew: crewStub({ lookup: async (query) => { lookupQuery = query; return { id: 12345, name: "Crew Member", nickname: "CM", crewName: "Logistics", role: "Crew", displayName: "Crew Member", source: "remote" }; } }),
  });
  const response = await app.inject({ method: "GET", url: "/api/v1/crew/lookup?query=BADGE-01", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().id, 12345);
  assert.equal(lookupQuery, "BADGE-01");
  await app.close();
});

test("reports missing crew configuration without leaking settings", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 21, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    crew: crewStub({ lookup: async () => { throw new CrewDirectoryError("Crew-oppslag er ikke konfigurert.", "NOT_CONFIGURED"); } }),
  });
  const response = await app.inject({ method: "GET", url: "/api/v1/crew/lookup?query=12345", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "NOT_CONFIGURED");
  await app.close();
});

test("lists private equipment rules for logistics users", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 21, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    privateEquipment: privateEquipmentStub({ listNotices: async () => [{ ownerName: "Eier", prefix: "PRIVAT-", issueMessage: "Bekreft.", returnMessage: "Returner." }] }),
  });
  const response = await app.inject({ method: "GET", url: "/api/v1/private-equipment/notices", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json()[0].prefix, "PRIVAT-");
  await app.close();
});

test("creates a private equipment rule with actor context", async () => {
  let actor = 0;
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: {
      getPublicConfig: async () => { throw new Error("not called"); },
      authenticate: async () => ({ id: 27, name: "Lager", firstName: "Lager", lastName: "", email: "lager@example.test", wannabeId: null, roles: ["logistikk"] }),
    },
    privateEquipment: privateEquipmentStub({ create: async (input, actorUserId) => { actor = actorUserId; return { id: 3, ownerName: input.ownerName, barcodePrefix: input.barcodePrefix, prefix: input.barcodePrefix, issueMessage: "Bekreft.", returnMessage: "Returner.", equipmentCount: 0, lowestSerial: null, highestSerial: null, equipmentItems: [] }; } }),
  });
  const response = await app.inject({ method: "POST", url: "/api/v1/private-equipment", headers: { authorization: "Bearer valid" }, payload: { ownerName: "Eier", barcodePrefix: "PRIVAT-" } });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().id, 3);
  assert.equal(actor, 27);
  await app.close();
});
