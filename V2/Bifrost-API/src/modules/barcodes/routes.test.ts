import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../app.js";
import { createBarcodeService } from "./service.js";

const auth = (roles: string[]) => ({
  getPublicConfig: async () => { throw new Error("not called"); },
  authenticate: async () => ({
    id: 42,
    name: "Barcode User",
    firstName: "Barcode",
    lastName: "User",
    email: "barcode@example.test",
    wannabeId: 420,
    roles,
  }),
});

test("exports an authorized V1-compatible UDL download", async () => {
  const app = buildApp({
    checkDatabase: async () => undefined,
    auth: auth(["logistikk"]),
    barcodes: createBarcodeService(),
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/barcodes/export",
    headers: { authorization: "Bearer valid" },
    payload: { filename: "mine-koder", rangeStart: "TG-001", rangeEnd: "TG-003" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "text/plain; charset=UTF-8");
  assert.equal(response.headers["content-disposition"], 'attachment; filename="mine-koder.udl"');
  assert.equal(response.headers["x-barcode-count"], "3");
  assert.equal(response.rawPayload.toString("utf8"), "\uFEFFTG-001\r\nTG-002\r\nTG-003\r\n");
  await app.close();
});

test("keeps barcode export limited to the four V1 logistics roles", async () => {
  for (const role of ["developer", "chief", "co-chief", "logistikk"]) {
    const app = buildApp({ checkDatabase: async () => undefined, auth: auth([role]), barcodes: createBarcodeService() });
    const response = await app.inject({ method: "POST", url: "/api/v1/barcodes/export", headers: { authorization: "Bearer valid" }, payload: { codes: "TG-001" } });
    assert.equal(response.statusCode, 200, role);
    await app.close();
  }

  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["bruker"]), barcodes: createBarcodeService() });
  const denied = await app.inject({ method: "POST", url: "/api/v1/barcodes/export", headers: { authorization: "Bearer valid" }, payload: { codes: "TG-001" } });
  assert.equal(denied.statusCode, 403);
  await app.close();
});
