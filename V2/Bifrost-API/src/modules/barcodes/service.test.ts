import assert from "node:assert/strict";
import test from "node:test";
import {
  BarcodeDomainError,
  barcodeExportFilename,
  buildBarcodeRange,
  collectBarcodeCodes,
  createBarcodeService,
} from "./service.js";

test("builds the V1 UDL format with BOM, CRLF and unique codes", () => {
  const result = createBarcodeService(() => new Date(2026, 8, 17, 4, 5, 6)).buildExport({
    filename: " TG 26 / etiketter ",
    codes: "TG26-0001\nTG26-0002\nTG26-0001",
    rangeStart: "TG26-0002",
    rangeEnd: "TG26-0004",
  });

  assert.equal(result.filename, "TG-26-etiketter.udl");
  assert.equal(result.count, 4);
  assert.equal(result.content.toString("utf8"), "\uFEFFTG26-0001\r\nTG26-0002\r\nTG26-0003\r\nTG26-0004\r\n");
});

test("preserves padding and suffixes in numeric ranges", () => {
  assert.deepEqual(buildBarcodeRange("TG-009-A", "TG-011-A"), ["TG-009-A", "TG-010-A", "TG-011-A"]);
});

test("rejects incomplete, reversed and incompatible ranges", () => {
  assert.throws(() => collectBarcodeCodes({ rangeStart: "TG-001" }), BarcodeDomainError);
  assert.throws(() => buildBarcodeRange("TG-010", "TG-001"), /større enn eller lik/);
  assert.throws(() => buildBarcodeRange("TG-001", "OTHER-002"), /samme tekst/);
});

test("limits generated ranges before allocating the export", () => {
  assert.throws(
    () => buildBarcodeRange("TG-000001", "TG-100001"),
    (error: unknown) => error instanceof BarcodeDomainError && error.code === "TOO_MANY_CODES",
  );
});

test("uses the V1 timestamp fallback when a filename sanitizes to empty", () => {
  assert.equal(barcodeExportFilename("...", new Date(2026, 8, 17, 4, 5, 6)), "strekkoder-20260917-040506");
});
