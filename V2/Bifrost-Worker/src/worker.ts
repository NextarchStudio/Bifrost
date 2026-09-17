import {
  createDatabase,
  jobs,
  readDatabaseConfig,
  roles,
  secureSettings,
  systemSettings,
  userRoles,
  users,
  webOrigins,
} from "@bifrost/database";
import { decryptValue, loadOrCreateKeyFile } from "@bifrost/security";
import { and, asc, eq, lt, lte, or } from "drizzle-orm";
import nodemailer from "nodemailer";
import { hostname } from "node:os";
import { resolve } from "node:path";
import { buildWelcomeMail } from "./welcome-mail.js";

const intervalMs = 5_000;
const staleLockMs = 10 * 60 * 1_000;
const maxAttempts = 5;
const batchSize = 10;
const workerId = `${hostname()}:${process.pid}`.slice(0, 120);
const database = createDatabase(readDatabaseConfig());
const masterKey = await loadOrCreateKeyFile(resolve(process.cwd(), "../var/secrets/settings.key"));
let activeRun: Promise<void> | undefined;
let shuttingDown = false;

const runJobs = async (): Promise<void> => {
  let processed = 0;
  while (!shuttingDown && processed < batchSize) {
    const job = await claimWelcomeJob();
    if (!job) break;
    try {
      const result = await sendWelcomeEmail(job.userId);
      await database.db.update(jobs).set({
        status: "completed",
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        updatedAt: new Date(),
      }).where(eq(jobs.id, job.id));
      console.info(result === "sent" ? "welcome email sent" : "welcome email skipped because delivery is disabled", { jobId: job.id, userId: job.userId });
    } catch (error) {
      const failed = job.attempts >= maxAttempts;
      const delayMinutes = Math.min(60, 2 ** Math.max(0, job.attempts - 1));
      await database.db.update(jobs).set({
        status: failed ? "failed" : "pending",
        availableAt: new Date(Date.now() + delayMinutes * 60_000),
        lockedAt: null,
        lockedBy: null,
        lastError: errorMessage(error),
        updatedAt: new Date(),
      }).where(eq(jobs.id, job.id));
      console.error("welcome email failed", { jobId: job.id, userId: job.userId, attempts: job.attempts, failed, error: errorMessage(error) });
    }
    processed += 1;
  }
  if (processed > 0) console.info("worker batch complete", { processed, timestamp: new Date().toISOString() });
};

const run = (): Promise<void> => {
  if (activeRun) return activeRun;
  activeRun = runJobs().catch((error) => {
    console.error("worker run failed", { error: errorMessage(error) });
  }).finally(() => {
    activeRun = undefined;
  });
  return activeRun;
};

const timer = setInterval(() => void run(), intervalMs);
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info("Bifrost-Worker shutting down", { signal });
  clearInterval(timer);
  try {
    await activeRun;
    await database.pool.end();
    console.info("Bifrost-Worker shutdown complete", { signal });
  } catch (error) {
    console.error("Bifrost-Worker shutdown failed", { error: errorMessage(error), signal });
    process.exitCode = 1;
  }
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

console.info("Bifrost-Worker started", { intervalMs, workerId });
await run();

async function claimWelcomeJob(): Promise<{ id: number; userId: number; attempts: number } | null> {
  return database.db.transaction(async (tx) => {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - staleLockMs);
    const [job] = await tx.select().from(jobs).where(and(
      eq(jobs.type, "send_user_welcome_email"),
      lte(jobs.availableAt, now),
      or(eq(jobs.status, "pending"), and(eq(jobs.status, "processing"), lt(jobs.lockedAt, staleBefore))),
    )).orderBy(asc(jobs.availableAt), asc(jobs.id)).limit(1).for("update", { skipLocked: true });
    if (!job) return null;
    const payload = job.payload && typeof job.payload === "object" ? job.payload as Record<string, unknown> : {};
    const userId = typeof payload.userId === "number" ? payload.userId : Number(payload.userId);
    const attempts = job.attempts + 1;
    if (!Number.isSafeInteger(userId) || userId < 1) {
      await tx.update(jobs).set({ status: "failed", attempts, lastError: "Jobben mangler gyldig userId.", updatedAt: now }).where(eq(jobs.id, job.id));
      return null;
    }
    await tx.update(jobs).set({ status: "processing", attempts, lockedAt: now, lockedBy: workerId, updatedAt: now }).where(eq(jobs.id, job.id));
    return { id: job.id, userId, attempts };
  });
}

async function sendWelcomeEmail(userId: number): Promise<"sent" | "disabled"> {
  const [user] = await database.db.select({ id: users.id, name: users.name, email: users.email })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("Brukeren finnes ikke lenger.");
  const [settings, passwordRow, assignedRoles, origins] = await Promise.all([
    database.db.select({
      appName: systemSettings.appName,
      fromEmail: systemSettings.smtpFromEmail,
      fromName: systemSettings.smtpFromName,
      host: systemSettings.smtpHost,
      port: systemSettings.smtpPort,
      username: systemSettings.smtpUser,
      crypto: systemSettings.smtpCrypto,
      emailEnabled: systemSettings.crewProvisioningEmailEnabled,
    }).from(systemSettings).where(eq(systemSettings.id, 1)).limit(1).then((rows) => rows[0]),
    database.db.select({ encryptedValue: secureSettings.encryptedValue, keyVersion: secureSettings.keyVersion })
      .from(secureSettings).where(eq(secureSettings.key, "smtp.password")).limit(1).then((rows) => rows[0]),
    database.db.select({ name: roles.name, displayName: roles.displayName }).from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, userId)).orderBy(asc(roles.name)),
    database.db.select({ origin: webOrigins.origin }).from(webOrigins)
      .where(eq(webOrigins.enabled, true)).orderBy(asc(webOrigins.id)),
  ]);
  if (!settings?.emailEnabled) return "disabled";
  if (!settings.host || !settings.port || !settings.fromEmail) throw new Error("SMTP-vert, port eller avsender mangler.");
  const password = passwordRow
    ? decryptValue({ ciphertext: passwordRow.encryptedValue, keyVersion: passwordRow.keyVersion }, new Map([[passwordRow.keyVersion, masterKey]]))
    : null;
  if (settings.username && !password) throw new Error("Kryptert SMTP-passord mangler.");

  const secure = settings.crypto === "ssl" || settings.port === 465;
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure,
    requireTLS: settings.crypto === "tls",
    auth: settings.username ? { user: settings.username, pass: password ?? "" } : undefined,
  });
  const loginUrl = origins.map((item) => item.origin).find((origin) => origin.startsWith("https://")) ?? origins[0]?.origin ?? "";
  const message = buildWelcomeMail({
    appName: settings.appName?.trim() || "Bifrost",
    userName: user.name,
    loginUrl,
    roles: assignedRoles.map((role) => role.displayName?.trim() || role.name),
  });
  await transporter.sendMail({
    from: { name: settings.fromName?.trim() || settings.appName?.trim() || "Bifrost", address: settings.fromEmail },
    to: { name: user.name, address: user.email },
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  return "sent";
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "Ukjent worker-feil.").slice(0, 2_000);
}
