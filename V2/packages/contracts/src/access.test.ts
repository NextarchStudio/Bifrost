import assert from "node:assert/strict";
import test from "node:test";
import {
  BIFROST_ACCESS,
  BIFROST_ROLES,
  hasBifrostAccess,
  isBifrostDenied,
  type BifrostAccessArea,
  type BifrostRole,
} from "./index.js";

const expected: Record<BifrostAccessArea, readonly BifrostRole[]> = {
  logistics: ["developer", "chief", "co-chief", "logistikk"],
  vehicle: ["developer", "chief", "co-chief", "skiftleder", "logistikk"],
  vehicleEdit: ["developer", "chief", "co-chief", "skiftleder"],
  vehicleCompetencyAdmin: ["developer", "chief", "co-chief"],
  transport: ["developer", "chief", "co-chief", "logistikk", "innkjop"],
  transportManager: ["developer", "chief", "co-chief", "logistikk"],
  transportRequest: ["innkjop"],
  comms: ["developer", "chief", "co-chief", "logistikk", "sambandsansvarlig"],
  shop: ["developer", "chief", "co-chief", "logistikk", "shop"],
  crewClothing: ["developer", "chief", "co-chief", "logistikk", "shop"],
  crewClothingAdmin: ["developer", "chief", "co-chief"],
  taskManager: ["developer", "chief", "co-chief", "logistikk"],
  admin: ["developer", "chief", "co-chief"],
  systemSettings: ["developer"],
  feedbackViewAll: ["developer", "logistikk"],
  feedbackManager: ["developer"],
  profileView: ["developer", "chief", "co-chief", "skiftleder", "sambandsansvarlig", "logistikk"],
  profileRequestView: ["developer", "chief", "co-chief", "skiftleder", "sambandsansvarlig"],
  crewLookup: ["developer", "chief", "co-chief", "skiftleder", "sambandsansvarlig", "logistikk"],
  globalSearch: ["developer", "chief", "co-chief", "logistikk"],
  barcodeExport: ["developer", "chief", "co-chief", "logistikk"],
  equipmentRequestManager: ["developer", "chief", "co-chief", "logistikk"],
};

test("evaluates every authoritative V1 role against every access area", () => {
  assert.deepEqual(Object.keys(BIFROST_ACCESS).sort(), Object.keys(expected).sort());

  for (const [area, allowedRoles] of Object.entries(expected) as Array<[BifrostAccessArea, readonly BifrostRole[]]>) {
    for (const role of BIFROST_ROLES) {
      assert.equal(
        hasBifrostAccess([role], area),
        allowedRoles.includes(role),
        `${role} fikk feil resultat for ${area}`,
      );
    }
  }
});

test("keeps negative V1 roles authoritative even with an allowed role", () => {
  assert.equal(isBifrostDenied(["developer", "ingen_tilbakemeldinger"], "feedback"), true);
  assert.equal(isBifrostDenied(["developer"], "feedback"), false);
  assert.equal(isBifrostDenied(["bruker", "sperret"], "profilePicture"), true);
});

test("preserves intentional V1 route behavior for unresolved roles", () => {
  assert.equal(hasBifrostAccess(["transport_ansvarlig"], "transport"), false);
  assert.equal(hasBifrostAccess(["innkjop"], "shop"), false);
  assert.equal(hasBifrostAccess(["innkjop"], "transportRequest"), true);
});
