import type {
  CurrentUser,
  FeedbackEntry,
  FeedbackNotificationResponse,
  FeedbackStatus,
  FeedbackType,
  FeedbackWorkspaceResponse,
} from "@bifrost/contracts";
import {
  auditLogs,
  feedbackEntries,
  feedbackNotificationReads,
  feedbackNotifications,
  type DatabaseConnection,
} from "@bifrost/database";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";

const VISIBLE_STATUSES = ["pending", "on_hold", "approved", "in_progress"] as const;
const NOTIFICATION_STATUSES = ["fixed", "added"] as const;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

export interface FeedbackCreateInput {
  type: FeedbackType;
  title: string;
  description: string;
  needsDatabaseFix: boolean;
}

export interface FeedbackAttachmentUpload {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

export interface FeedbackAttachment {
  content: Buffer;
  mime: string;
  name: string;
}

export interface FeedbackStorageOptions {
  writeRoot: string;
  mirrorWriteRoots?: string[];
  readRoots: string[];
}

export class FeedbackDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "INVALID_FILE" | "FILE_TOO_LARGE") {
    super(message);
  }
}

export interface FeedbackService {
  workspace(userId: number, canViewAll: boolean, canManageAll: boolean): Promise<FeedbackWorkspaceResponse>;
  create(input: FeedbackCreateInput, user: CurrentUser, attachment?: FeedbackAttachmentUpload): Promise<{ id: number }>;
  updateStatus(id: number, status: FeedbackStatus, actorUserId: number): Promise<void>;
  deleteOwn(id: number, actorUserId: number): Promise<void>;
  attachmentForUser(id: number, userId: number, canViewAll: boolean): Promise<FeedbackAttachment>;
  notificationPayload(userId: number): Promise<FeedbackNotificationResponse>;
  markNotificationsAsRead(userId: number): Promise<void>;
}

type DatabaseTransaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];
type FeedbackRow = typeof feedbackEntries.$inferSelect;

export function createFeedbackService(database: DatabaseConnection, storage: FeedbackStorageOptions): FeedbackService {
  const writeRoots = [...new Set([storage.writeRoot, ...(storage.mirrorWriteRoots ?? [])].map((root) => resolve(root)))];
  const readRoots = [...new Set([...writeRoots, ...storage.readRoots].map((root) => resolve(root)))];

  return {
    async workspace(userId, canViewAll, canManageAll) {
      const [mine, all] = await Promise.all([
        database.db.select().from(feedbackEntries)
          .where(and(eq(feedbackEntries.requesterUserId, userId), inArray(feedbackEntries.status, VISIBLE_STATUSES)))
          .orderBy(desc(feedbackEntries.createdAt)),
        canViewAll
          ? database.db.select().from(feedbackEntries).where(inArray(feedbackEntries.status, VISIBLE_STATUSES)).orderBy(desc(feedbackEntries.createdAt))
          : Promise.resolve([]),
      ]);
      return { canViewAll, canManageAll, myEntries: mine.map(toFeedbackEntry), allEntries: all.map(toFeedbackEntry) };
    },

    async create(input, user, attachment) {
      const title = plainTitle(input.title);
      const description = input.description.trim().slice(0, 5000);
      if (title.length < 3) throw new FeedbackDomainError("Tittelen må inneholde minst tre tegn.", "CONFLICT");
      if (description.length < 10) throw new FeedbackDomainError("Beskrivelsen må inneholde minst ti tegn.", "CONFLICT");
      const stored = await storeAttachment(writeRoots, input.type, attachment);
      try {
        return await database.db.transaction(async (tx) => {
          const now = new Date();
          const requesterName = (`${user.firstName} ${user.lastName}`).trim() || user.name || "Ukjent bruker";
          const [created] = await tx.insert(feedbackEntries).values({
            requesterUserId: user.id,
            wannabeId: user.wannabeId,
            requesterName: requesterName.slice(0, 180),
            type: input.type,
            title,
            description,
            needsDatabaseFix: input.needsDatabaseFix,
            attachmentPath: stored?.relativePath ?? null,
            attachmentOriginalName: stored?.originalName ?? null,
            attachmentMime: stored?.mime ?? null,
            status: "pending",
            developerNote: null,
            resolvedAt: null,
            addedAt: null,
            createdAt: now,
            updatedAt: now,
          }).$returningId();
          if (!created) throw new Error("Tilbakemeldingen kunne ikke opprettes.");
          await writeAudit(tx, user.id, "create", created.id, {
            type: input.type,
            title,
            needs_database_fix: input.needsDatabaseFix ? 1 : 0,
          });
          return { id: created.id };
        });
      } catch (error) {
        if (stored) await Promise.all(stored.absolutePaths.map((path) => unlink(path).catch(() => undefined)));
        throw error;
      }
    },

    async updateStatus(id, status, actorUserId) {
      await database.db.transaction(async (tx) => {
        const [entry] = await tx.select().from(feedbackEntries).where(eq(feedbackEntries.id, id)).limit(1).for("update");
        if (!entry) throw new FeedbackDomainError("Tilbakemeldingen finnes ikke.", "NOT_FOUND");
        const allowed: FeedbackStatus[] = entry.type === "bug"
          ? ["in_progress", "fixed", "rejected"]
          : ["on_hold", "in_progress", "approved", "added", "rejected"];
        if (!allowed.includes(status)) throw new FeedbackDomainError("Ugyldig status for denne typen tilbakemelding.", "CONFLICT");
        const now = new Date();
        await tx.update(feedbackEntries).set({
          status,
          developerNote: null,
          resolvedAt: ["fixed", "added", "rejected"].includes(status) ? now : null,
          addedAt: status === "added" ? now : null,
          updatedAt: now,
        }).where(eq(feedbackEntries.id, id));
        if (status === "fixed" || status === "added") {
          await tx.insert(feedbackNotifications).values({
            feedbackEntryId: id,
            status,
            title: entry.title,
            message: entry.description,
            createdAt: now,
          });
        }
        await writeAudit(tx, actorUserId, "status", id, { status });
      });
    },

    async deleteOwn(id, actorUserId) {
      let attachmentPath: string | null = null;
      await database.db.transaction(async (tx) => {
        const [entry] = await tx.select().from(feedbackEntries).where(eq(feedbackEntries.id, id)).limit(1).for("update");
        if (!entry) throw new FeedbackDomainError("Tilbakemeldingen finnes ikke.", "NOT_FOUND");
        if (entry.requesterUserId !== actorUserId) throw new FeedbackDomainError("Du kan bare slette egne tilbakemeldinger.", "FORBIDDEN");
        if (entry.status !== "pending") throw new FeedbackDomainError("Bare ventende tilbakemeldinger kan slettes.", "CONFLICT");
        attachmentPath = entry.attachmentPath;
        await tx.delete(feedbackEntries).where(eq(feedbackEntries.id, id));
        await writeAudit(tx, actorUserId, "delete", id, null);
      });
      if (attachmentPath) await removeStoredAttachment(attachmentPath, readRoots);
    },

    async attachmentForUser(id, userId, canViewAll) {
      const [entry] = await database.db.select({
        requesterUserId: feedbackEntries.requesterUserId,
        path: feedbackEntries.attachmentPath,
        name: feedbackEntries.attachmentOriginalName,
        mime: feedbackEntries.attachmentMime,
      }).from(feedbackEntries).where(eq(feedbackEntries.id, id)).limit(1);
      if (!entry) throw new FeedbackDomainError("Vedlegget finnes ikke.", "NOT_FOUND");
      if (entry.requesterUserId !== userId && !canViewAll) throw new FeedbackDomainError("Du har ikke tilgang til dette vedlegget.", "FORBIDDEN");
      if (!entry.path) throw new FeedbackDomainError("Vedlegget finnes ikke.", "NOT_FOUND");
      const content = await readStoredAttachment(entry.path, readRoots);
      if (!content) throw new FeedbackDomainError("Vedlegget finnes ikke på filsystemet.", "NOT_FOUND");
      return {
        content,
        mime: allowedStoredMime(entry.mime) ?? detectImageMime(content) ?? "application/octet-stream",
        name: safeOriginalName(entry.name) || "vedlegg",
      };
    },

    async notificationPayload(userId) {
      const [rows, unreadRows] = await Promise.all([
        database.db.select({
          id: feedbackNotifications.id,
          status: feedbackNotifications.status,
          title: feedbackNotifications.title,
          message: feedbackNotifications.message,
          createdAt: feedbackNotifications.createdAt,
          readId: feedbackNotificationReads.id,
        }).from(feedbackNotifications)
          .leftJoin(feedbackNotificationReads, and(
            eq(feedbackNotificationReads.notificationId, feedbackNotifications.id),
            eq(feedbackNotificationReads.userId, userId),
          ))
          .where(inArray(feedbackNotifications.status, NOTIFICATION_STATUSES))
          .orderBy(desc(feedbackNotifications.createdAt))
          .limit(3),
        database.db.select({ total: count() }).from(feedbackNotifications)
          .leftJoin(feedbackNotificationReads, and(
            eq(feedbackNotificationReads.notificationId, feedbackNotifications.id),
            eq(feedbackNotificationReads.userId, userId),
          ))
          .where(and(inArray(feedbackNotifications.status, NOTIFICATION_STATUSES), isNull(feedbackNotificationReads.id))),
      ]);
      return {
        items: rows.map((row) => ({
          id: row.id,
          status: row.status === "added" ? "added" : "fixed",
          statusLabel: row.status === "added" ? "Implementert" : "Bug fikset",
          title: row.title,
          message: row.message ?? "",
          createdAt: row.createdAt.toISOString(),
          isRead: row.readId !== null,
        })),
        unreadCount: Number(unreadRows[0]?.total ?? 0),
      };
    },

    async markNotificationsAsRead(userId) {
      await database.db.transaction(async (tx) => {
        const unread = await tx.select({ id: feedbackNotifications.id }).from(feedbackNotifications)
          .leftJoin(feedbackNotificationReads, and(
            eq(feedbackNotificationReads.notificationId, feedbackNotifications.id),
            eq(feedbackNotificationReads.userId, userId),
          ))
          .where(and(inArray(feedbackNotifications.status, NOTIFICATION_STATUSES), isNull(feedbackNotificationReads.id)));
        if (unread.length === 0) return;
        const now = new Date();
        await tx.insert(feedbackNotificationReads).values(unread.map((item) => ({ notificationId: item.id, userId, seenAt: now })))
          .onDuplicateKeyUpdate({ set: { seenAt: now } });
      });
    },
  };
}

function toFeedbackEntry(row: FeedbackRow): FeedbackEntry {
  return {
    id: row.id,
    requesterUserId: row.requesterUserId,
    wannabeId: row.wannabeId,
    requesterName: row.requesterName,
    type: row.type === "bug" ? "bug" : "feature",
    title: row.title,
    description: row.description,
    needsDatabaseFix: row.needsDatabaseFix,
    hasAttachment: Boolean(row.attachmentPath),
    attachmentOriginalName: row.attachmentOriginalName,
    status: normalizeStatus(row.status),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    addedAt: row.addedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function storeAttachment(writeRoots: string[], type: FeedbackType, attachment?: FeedbackAttachmentUpload) {
  if (!attachment) return null;
  if (type !== "bug") throw new FeedbackDomainError("Bildevedlegg er bare tilgjengelig for bugs.", "INVALID_FILE");
  if (attachment.buffer.length > MAX_ATTACHMENT_SIZE) throw new FeedbackDomainError("Bildet kan maks være 5 MB.", "FILE_TOO_LARGE");
  const extension = extname(attachment.filename).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) {
    throw new FeedbackDomainError("Bare JPG, PNG, WEBP og GIF er tillatt.", "INVALID_FILE");
  }
  const detectedMime = detectImageMime(attachment.buffer);
  if (!detectedMime || !allowedStoredMime(attachment.mimetype)) throw new FeedbackDomainError("Ugyldig bildefil.", "INVALID_FILE");
  const storedName = `${Math.floor(Date.now() / 1000)}_${randomBytes(10).toString("hex")}${extension}`;
  const absolutePaths: string[] = [];
  try {
    for (const writeRoot of writeRoots) {
      const directory = resolve(writeRoot, "uploads", "feedback");
      await mkdir(directory, { recursive: true });
      const absolutePath = resolve(directory, storedName);
      await writeFile(absolutePath, attachment.buffer, { flag: "wx" });
      absolutePaths.push(absolutePath);
    }
  } catch (error) {
    await Promise.all(absolutePaths.map((path) => unlink(path).catch(() => undefined)));
    throw error;
  }
  return {
    absolutePaths,
    relativePath: `uploads/feedback/${storedName}`,
    originalName: safeOriginalName(attachment.filename).slice(0, 255),
    mime: detectedMime,
  };
}

async function readStoredAttachment(relativePath: string, roots: string[]): Promise<Buffer | null> {
  const safePath = safeAttachmentPath(relativePath);
  if (!safePath) return null;
  for (const root of roots) {
    const path = resolveWithin(root, safePath);
    if (!path) continue;
    try { return await readFile(path); } catch { /* Try the next compatible V1/V2 root. */ }
  }
  return null;
}

async function removeStoredAttachment(relativePath: string, roots: string[]): Promise<void> {
  const safePath = safeAttachmentPath(relativePath);
  if (!safePath) return;
  for (const root of roots) {
    const path = resolveWithin(root, safePath);
    if (path) await unlink(path).catch(() => undefined);
  }
}

function safeAttachmentPath(value: string): string | null {
  const normalized = value.trim().replaceAll("\\", "/");
  return /^uploads\/feedback\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(normalized) ? normalized : null;
}

function resolveWithin(root: string, relativePath: string): string | null {
  const absoluteRoot = resolve(root);
  const target = resolve(absoluteRoot, ...relativePath.split("/"));
  return target.startsWith(`${absoluteRoot}${sep}`) ? target : null;
}

function detectImageMime(content: Buffer): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) return "image/jpeg";
  if (content.length >= 8 && content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (content.length >= 12 && content.subarray(0, 4).toString("ascii") === "RIFF" && content.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (content.length >= 6 && ["GIF87a", "GIF89a"].includes(content.subarray(0, 6).toString("ascii"))) return "image/gif";
  return null;
}

function allowedStoredMime(value: string | null): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  const mime = (value ?? "").toLowerCase();
  return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime) ? mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif" : null;
}

function safeOriginalName(value: string | null): string {
  return basename((value ?? "").replace(/[\r\n"]/g, "")).trim();
}

function plainTitle(value: string): string { return value.replace(/<[^>]*>/g, "").trim().slice(0, 180); }
function normalizeStatus(value: string): FeedbackStatus { return ["pending", "on_hold", "approved", "in_progress", "fixed", "added", "rejected"].includes(value) ? value as FeedbackStatus : "pending"; }
async function writeAudit(tx: DatabaseTransaction, actorUserId: number, action: string, entityId: number, diffJson: unknown): Promise<void> {
  await tx.insert(auditLogs).values({ actorUserId, action, entityType: "feedback_entry", entityId, diffJson, createdAt: new Date() });
}
