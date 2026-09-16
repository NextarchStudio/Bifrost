import assert from "node:assert/strict";
import test from "node:test";
import { privateEquipmentNoticeForBarcode } from "./service.js";

test("matches private equipment prefixes case-insensitively", () => {
  const notice = privateEquipmentNoticeForBarcode([
    { ownerName: "Test Eier", barcodePrefix: "PRIVAT-" },
  ], "privat-0042");

  assert.equal(notice?.ownerName, "Test Eier");
  assert.equal(notice?.prefix, "PRIVAT-");
  assert.match(notice?.issueMessage ?? "", /Test Eier/);
});

test("returns no private equipment notice for an unrelated barcode", () => {
  const notice = privateEquipmentNoticeForBarcode([
    { ownerName: "Test Eier", barcodePrefix: "PRIVAT-" },
  ], "BIFROST-0042");

  assert.equal(notice, null);
});
