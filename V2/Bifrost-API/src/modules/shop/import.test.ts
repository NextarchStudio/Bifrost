import assert from "node:assert/strict";
import test from "node:test";
import { mapImportedRows, parseShopImport } from "./import.js";

test("maps V1 and English inventory headers", () => {
  const rows = mapImportedRows([
    ["ID", "Vare", "Kategori", "Storrelse", "Antall", "Notater"],
    ["4", "T-skjorte", "Klær", "XL", "12", "Blå"],
  ]);
  assert.deepEqual(rows, [{ id: 4, name: "T-skjorte", category: "Klær", size: "XL", quantity: 12, notes: "Blå" }]);
});

test("parses quoted comma CSV and skips empty item rows", async () => {
  const rows = await parseShopImport("lager.csv", Buffer.from('name,category,size,quantity,notes\n"Kopp, stor",Profil,,7,"Med, logo"\n,,,,\n'));
  assert.deepEqual(rows, [{ name: "Kopp, stor", category: "Profil", size: null, quantity: 7, notes: "Med, logo" }]);
});

test("rejects unsupported import extensions", async () => {
  await assert.rejects(() => parseShopImport("lager.exe", Buffer.from("")), /Bare XLSX/);
});
