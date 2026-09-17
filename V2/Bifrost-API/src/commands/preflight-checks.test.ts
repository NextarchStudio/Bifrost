import assert from "node:assert/strict";
import test from "node:test";
import { compareSchema, missingRoles } from "./preflight-checks.js";

test("reports missing tables and columns without case sensitivity", () => {
  const result = compareSchema({ users: ["id", "email"], roles: ["id", "name"] }, [
    { tableName: "USERS", columnName: "ID" }, { tableName: "users", columnName: "email" }, { tableName: "roles", columnName: "id" },
  ]);
  assert.deepEqual(result, { missingTables: [], missingColumns: ["roles.name"] });
  assert.deepEqual(compareSchema({ users: ["id"], tasks: ["id"] }, [{ tableName: "users", columnName: "id" }]).missingTables, ["tasks"]);
});

test("reports required V1 roles that are absent", () => {
  assert.deepEqual(missingRoles(["developer", "bruker"], ["developer", "chief", "bruker"]), ["chief"]);
});
