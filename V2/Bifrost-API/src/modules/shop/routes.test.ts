import { SHOP_SIZE_OPTIONS } from "@bifrost/contracts";
import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../app.js";
import type { CrewClothingService } from "../crew-clothing/service.js";
import type { ShopService } from "./service.js";

const shopWorkspace = { categories: [], items: [], movements: [], sizeOptions: SHOP_SIZE_OPTIONS };
const clothingWorkspace = { canManageCrews: false, crews: [], members: [], inventory: [], sizeOptions: SHOP_SIZE_OPTIONS };
const shopStub = (overrides: Partial<ShopService> = {}): ShopService => ({
  workspace: async () => shopWorkspace,
  createCategory: async () => ({ id: 1 }),
  createItem: async () => ({ id: 1 }),
  move: async () => undefined,
  deleteItem: async () => undefined,
  importRows: async () => ({ created: 0, checkedIn: 0, checkedOut: 0, unchanged: 0 }),
  ...overrides,
});
const clothingStub = (overrides: Partial<CrewClothingService> = {}): CrewClothingService => ({
  workspace: async () => clothingWorkspace,
  lookup: async () => { throw new Error("not called"); },
  createCrew: async () => ({ id: 1 }),
  updateCrew: async () => undefined,
  updateMember: async () => undefined,
  setDelivered: async () => undefined,
  saveInventory: async () => ({ id: 1 }),
  updateInventory: async () => undefined,
  deleteInventory: async () => undefined,
  ...overrides,
});
const auth = (roles: string[]) => ({
  getPublicConfig: async () => { throw new Error("not called"); },
  authenticate: async () => ({ id: 42, name: "Shop", firstName: "Shop", lastName: "Bruker", email: "shop@example.test", wannabeId: 420, roles }),
});

test("preserves all five V1 shop roles and rejects innkjop", async () => {
  for (const role of ["developer", "chief", "co-chief", "logistikk", "shop"]) {
    const app = buildApp({ checkDatabase: async () => undefined, auth: auth([role]), shop: shopStub(), crewClothing: clothingStub() });
    const response = await app.inject({ method: "GET", url: "/api/v1/shop", headers: { authorization: "Bearer valid" } });
    assert.equal(response.statusCode, 200, role);
    await app.close();
  }
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["innkjop"]), shop: shopStub(), crewClothing: clothingStub() });
  const denied = await app.inject({ method: "GET", url: "/api/v1/shop", headers: { authorization: "Bearer valid" } });
  assert.equal(denied.statusCode, 403);
  await app.close();
});

test("records checkout quantity and actor context", async () => {
  let captured: unknown[] = [];
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: auth(["shop"]), shop: shopStub({ move: async (...args) => { captured = args; } }), crewClothing: clothingStub(),
  });
  const response = await app.inject({ method: "POST", url: "/api/v1/shop/items/8/check-out", headers: { authorization: "Bearer valid" }, payload: { quantity: 3 } });
  assert.equal(response.statusCode, 204);
  assert.deepEqual(captured, [8, "checkout", 3, 42]);
  await app.close();
});

test("imports a V1 CSV inventory upload", async () => {
  let importedName = "";
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: auth(["logistikk"]),
    shop: shopStub({ importRows: async (rows) => { importedName = rows[0]?.name ?? ""; return { created: 1, checkedIn: 0, checkedOut: 0, unchanged: 0 }; } }),
    crewClothing: clothingStub(),
  });
  const boundary = "bifrost-test-boundary";
  const body = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="inventory_file"; filename="lager.csv"\r\nContent-Type: text/csv\r\n\r\nVare;Kategori;Storrelse;Antall;Notater\r\nKopp;Profil;-;4;-\r\n--${boundary}--\r\n`);
  const response = await app.inject({ method: "POST", url: "/api/v1/shop/import", headers: { authorization: "Bearer valid", "content-type": `multipart/form-data; boundary=${boundary}` }, payload: body });
  assert.equal(response.statusCode, 200);
  assert.equal(importedName, "Kopp");
  assert.equal(response.json().created, 1);
  await app.close();
});

test("keeps crew administration limited to V1 admin roles", async () => {
  for (const role of ["logistikk", "shop"]) {
    const app = buildApp({ checkDatabase: async () => undefined, auth: auth([role]), shop: shopStub(), crewClothing: clothingStub() });
    const response = await app.inject({ method: "POST", url: "/api/v1/crew-clothing/crews", headers: { authorization: "Bearer valid" }, payload: { name: "Crew A", tshirtMax: 1, hoodieMax: 1 } });
    assert.equal(response.statusCode, 403, role);
    await app.close();
  }
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["chief"]), shop: shopStub(), crewClothing: clothingStub({ createCrew: async () => ({ id: 7 }) }) });
  const allowed = await app.inject({ method: "POST", url: "/api/v1/crew-clothing/crews", headers: { authorization: "Bearer valid" }, payload: { name: "Crew A", tshirtMax: 1, hoodieMax: 1 } });
  assert.equal(allowed.statusCode, 201);
  assert.equal(allowed.json().id, 7);
  await app.close();
});

test("supports combined crew-clothing delivery updates", async () => {
  let types: string[] = [];
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: auth(["shop"]), shop: shopStub(),
    crewClothing: clothingStub({ setDelivered: async (_id, itemTypes) => { types = itemTypes; } }),
  });
  const response = await app.inject({ method: "POST", url: "/api/v1/crew-clothing/members/9/delivery", headers: { authorization: "Bearer valid" }, payload: { itemTypes: ["hoodie", "tshirt"], delivered: true } });
  assert.equal(response.statusCode, 204);
  assert.deepEqual(types, ["hoodie", "tshirt"]);
  await app.close();
});
