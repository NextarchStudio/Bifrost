import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../app.js";
import type { FeedbackService } from "./service.js";

const workspace = { canViewAll: false, canManageAll: false, myEntries: [], allEntries: [] };
const notifications = { items: [], unreadCount: 0 };
const serviceStub = (overrides: Partial<FeedbackService> = {}): FeedbackService => ({
  workspace: async () => workspace,
  create: async () => ({ id: 1 }),
  updateStatus: async () => undefined,
  deleteOwn: async () => undefined,
  attachmentForUser: async () => ({ content: Buffer.from("image"), mime: "image/png", name: "bug.png" }),
  notificationPayload: async () => notifications,
  markNotificationsAsRead: async () => undefined,
  ...overrides,
});
const auth = (roles: string[]) => ({
  getPublicConfig: async () => { throw new Error("not called"); },
  authenticate: async () => ({ id: 5, name: "Vanlig Bruker", firstName: "Vanlig", lastName: "Bruker", email: "user@example.test", wannabeId: 50, roles }),
});

test("preserves V1 feedback overview roles", async () => {
  for (const [role, canViewAll, canManageAll] of [["bruker", false, false], ["logistikk", true, false], ["developer", true, true]] as const) {
    let captured: unknown[] = [];
    const app = buildApp({ checkDatabase: async () => undefined, auth: auth([role]), feedback: serviceStub({ workspace: async (...args) => { captured = args; return workspace; } }) });
    const response = await app.inject({ method: "GET", url: "/api/v1/feedback", headers: { authorization: "Bearer valid" } });
    assert.equal(response.statusCode, 200, role);
    assert.deepEqual(captured, [5, canViewAll, canManageAll]);
    await app.close();
  }
});

test("negative V1 role blocks feedback but not global notifications", async () => {
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["bruker", "ingen_tilbakemeldinger"]), feedback: serviceStub() });
  const blocked = await app.inject({ method: "GET", url: "/api/v1/feedback", headers: { authorization: "Bearer valid" } });
  const allowed = await app.inject({ method: "GET", url: "/api/v1/feedback/notifications", headers: { authorization: "Bearer valid" } });
  assert.equal(blocked.statusCode, 403);
  assert.equal(allowed.statusCode, 200);
  await app.close();
});

test("accepts a multipart feedback form and image", async () => {
  let captured: unknown[] = [];
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["bruker"]), feedback: serviceStub({ create: async (...args) => { captured = args; return { id: 12 }; } }) });
  const boundary = "bifrost-feedback-boundary";
  const body = multipartBody(boundary, [
    ["type", "bug"],
    ["title", "Feil i lagerlisten"],
    ["description", "Lagerlisten viser feil antall enheter."],
    ["needs_database_fix", "1"],
  ], { name: "attachment", filename: "bug.png", type: "image/png", content: Buffer.from([0x89, 0x50, 0x4e, 0x47]) });
  const response = await app.inject({ method: "POST", url: "/api/v1/feedback", headers: { authorization: "Bearer valid", "content-type": `multipart/form-data; boundary=${boundary}` }, payload: body });
  assert.equal(response.statusCode, 201);
  assert.equal((captured[0] as { needsDatabaseFix: boolean }).needsDatabaseFix, true);
  assert.equal((captured[2] as { filename: string }).filename, "bug.png");
  await app.close();
});

test("restricts status changes to developer", async () => {
  const deniedApp = buildApp({ checkDatabase: async () => undefined, auth: auth(["logistikk"]), feedback: serviceStub() });
  const denied = await deniedApp.inject({ method: "PATCH", url: "/api/v1/feedback/9/status", headers: { authorization: "Bearer valid" }, payload: { status: "fixed" } });
  assert.equal(denied.statusCode, 403);
  await deniedApp.close();

  let captured: unknown[] = [];
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["developer"]), feedback: serviceStub({ updateStatus: async (...args) => { captured = args; } }) });
  const response = await app.inject({ method: "PATCH", url: "/api/v1/feedback/9/status", headers: { authorization: "Bearer valid" }, payload: { status: "fixed" } });
  assert.equal(response.statusCode, 204);
  assert.deepEqual(captured, [9, "fixed", 5]);
  await app.close();
});

test("delegates pending-entry ownership checks to the service", async () => {
  let captured: unknown[] = [];
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["bruker"]), feedback: serviceStub({ deleteOwn: async (...args) => { captured = args; } }) });
  const response = await app.inject({ method: "DELETE", url: "/api/v1/feedback/7", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 204);
  assert.deepEqual(captured, [7, 5]);
  await app.close();
});

test("returns an authorized inline attachment", async () => {
  let canViewAll = true;
  const app = buildApp({ checkDatabase: async () => undefined, auth: auth(["bruker"]), feedback: serviceStub({ attachmentForUser: async (_id, _userId, canView) => { canViewAll = canView; return { content: Buffer.from("image"), mime: "image/png", name: "skjermbilde.png" }; } }) });
  const response = await app.inject({ method: "GET", url: "/api/v1/feedback/4/attachment", headers: { authorization: "Bearer valid" } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "image/png");
  assert.equal(canViewAll, false);
  await app.close();
});

function multipartBody(boundary: string, fields: Array<[string, string]>, file: { name: string; filename: string; type: string; content: Buffer }): Buffer {
  const chunks: Buffer[] = [];
  for (const [name, value] of fields) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.type}\r\n\r\n`));
  chunks.push(file.content, Buffer.from(`\r\n--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}
