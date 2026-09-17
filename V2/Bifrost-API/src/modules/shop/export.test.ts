import assert from "node:assert/strict";
import test from "node:test";
import type { ShopItem } from "@bifrost/contracts";
import { buildShopCsv, buildShopPdf } from "./export.js";

const item: ShopItem = {
  id: 7,
  categoryId: 2,
  categoryName: "Profil",
  name: 'Kopp "stor"',
  size: null,
  quantity: 12,
  status: "active",
  discontinuedAt: null,
  notes: "TG-logo",
  createdAt: "2026-09-17T10:00:00.000Z",
  updatedAt: "2026-09-17T10:00:00.000Z",
};

test("exports a UTF-8 BOM CSV compatible with the V1 import", () => {
  const csv = buildShopCsv([item]).toString("utf8");
  assert.ok(csv.startsWith("\uFEFF\"ID\";\"Vare\""));
  assert.match(csv, /\"Kopp \"\"stor\"\"\"/);
});

test("exports a complete PDF document", () => {
  const pdf = buildShopPdf([item]).toString("latin1");
  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.match(pdf, /Varelager/);
  assert.ok(pdf.endsWith("%%EOF"));
});
