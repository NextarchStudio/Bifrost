import type { BifrostTask, TaskPriority, TaskStatus, TaskType, TaskWorkspaceResponse } from "@bifrost/contracts";
import { auditLogs, tasks, transportJobs, users, type DatabaseConnection } from "@bifrost/database";
import { asc, desc, eq, inArray } from "drizzle-orm";

export const TASK_MANAGER_ROLES: ReadonlySet<string> = new Set(["developer", "chief", "co-chief", "logistikk"]);

export interface TaskCreateInput {
  title: string;
  type: TaskType;
  transportJobId?: number | null;
  status: TaskStatus;
  priority: TaskPriority;
  message?: string | null;
  description: string;
  assignedUserId: number;
  dueAt: Date;
}

export class TaskDomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "CONFLICT" | "FORBIDDEN") { super(message); }
}

export interface TaskService {
  workspace(userId: number, canManageAll: boolean): Promise<TaskWorkspaceResponse>;
  create(input: TaskCreateInput, actorUserId: number): Promise<{ id: number }>;
  updateStatus(id: number, status: TaskStatus, actorUserId: number, canManageAll: boolean): Promise<void>;
}

type DatabaseTransaction = Parameters<Parameters<DatabaseConnection["db"]["transaction"]>[0]>[0];
type TaskRow = typeof tasks.$inferSelect;

export function createTaskService(database: DatabaseConnection): TaskService {
  return {
    async workspace(userId, canManageAll) {
      const taskRows = canManageAll
        ? await database.db.select().from(tasks)
        : await database.db.select().from(tasks).where(eq(tasks.assignedUserId, userId));
      const userIds = [...new Set(taskRows.flatMap((task) => [task.assignedUserId, task.createdByUserId]))];
      const transportIds = [...new Set(taskRows.flatMap((task) => task.transportJobId ? [task.transportJobId] : []))];
      const [relatedUsers, relatedTransports, userOptions, transportOptions] = await Promise.all([
        userIds.length ? database.db.select({ id: users.id, name: users.name, wannabeId: users.wannabeId }).from(users).where(inArray(users.id, userIds)) : Promise.resolve([]),
        transportIds.length ? database.db.select({ id: transportJobs.id, description: transportJobs.description, status: transportJobs.status }).from(transportJobs).where(inArray(transportJobs.id, transportIds)) : Promise.resolve([]),
        canManageAll ? database.db.select({ id: users.id, name: users.name, wannabeId: users.wannabeId }).from(users).orderBy(asc(users.name)) : Promise.resolve([]),
        canManageAll ? database.db.select({ id: transportJobs.id, description: transportJobs.description, status: transportJobs.status }).from(transportJobs)
          .where(inArray(transportJobs.status, ["open", "assigned", "in_progress"])).orderBy(desc(transportJobs.createdAt)) : Promise.resolve([]),
      ]);
      const usersById = new Map(relatedUsers.map((user) => [user.id, user]));
      const transportsById = new Map(relatedTransports.map((job) => [job.id, job]));
      const mapped = taskRows.map((task) => toTask(task, usersById, transportsById)).sort(compareTasks);
      return {
        canManageAll,
        currentUserId: userId,
        myTasks: mapped.filter((task) => task.assignedUserId === userId),
        allTasks: canManageAll ? mapped : [],
        users: userOptions,
        transportJobs: transportOptions.map((job) => ({ ...job, description: job.description })),
      };
    },

    async create(input, actorUserId) {
      return database.db.transaction(async (tx) => {
        const [assigned] = await tx.select({ id: users.id }).from(users).where(eq(users.id, input.assignedUserId)).limit(1);
        if (!assigned) throw new TaskDomainError("Valgt bruker finnes ikke.", "NOT_FOUND");
        const transportJobId = input.type === "transport" ? input.transportJobId ?? null : null;
        if (transportJobId) {
          const [job] = await tx.select({ id: transportJobs.id }).from(transportJobs).where(eq(transportJobs.id, transportJobId)).limit(1);
          if (!job) throw new TaskDomainError("Valgt transportoppdrag finnes ikke.", "NOT_FOUND");
        }
        const title = plainTitle(input.title);
        const description = input.description.trim().slice(0, 5000);
        if (title.length < 3) throw new TaskDomainError("Oppgavenavn må inneholde minst tre tegn.", "CONFLICT");
        if (description.length < 5) throw new TaskDomainError("Beskrivelsen må inneholde minst fem tegn.", "CONFLICT");
        const now = new Date();
        const [created] = await tx.insert(tasks).values({
          title, type: input.type, transportJobId, status: input.status, priority: input.priority,
          message: nullableText(input.message, 5000), description, assignedUserId: input.assignedUserId,
          createdByUserId: actorUserId, dueAt: input.dueAt, completedAt: input.status === "completed" ? now : null,
          createdAt: now, updatedAt: now,
        }).$returningId();
        if (!created) throw new Error("Oppgaven kunne ikke opprettes.");
        await writeAudit(tx, actorUserId, "create", "task", created.id, {
          type: input.type, status: input.status, priority: input.priority, assigned_user_id: input.assignedUserId, transport_job_id: transportJobId,
        });
        return { id: created.id };
      });
    },

    async updateStatus(id, status, actorUserId, canManageAll) {
      await database.db.transaction(async (tx) => {
        const [task] = await tx.select().from(tasks).where(eq(tasks.id, id)).limit(1).for("update");
        if (!task) throw new TaskDomainError("Oppgaven finnes ikke.", "NOT_FOUND");
        if (!canManageAll && task.assignedUserId !== actorUserId) throw new TaskDomainError("Du kan bare oppdatere egne oppgaver.", "FORBIDDEN");
        const now = new Date();
        await tx.update(tasks).set({ status, completedAt: status === "completed" ? now : null, updatedAt: now }).where(eq(tasks.id, id));
        await writeAudit(tx, actorUserId, "status", "task", id, { status });
      });
    },
  };
}

function toTask(task: TaskRow, usersById: Map<number, { id: number; name: string; wannabeId: number | null }>, transportsById: Map<number, { id: number; description: string; status: string }>): BifrostTask {
  const assigned = usersById.get(task.assignedUserId);
  const creator = usersById.get(task.createdByUserId);
  const transport = task.transportJobId ? transportsById.get(task.transportJobId) : undefined;
  return {
    id: task.id, title: task.title, type: task.type === "transport" ? "transport" : "work",
    transportJobId: task.transportJobId, transportDescription: transport?.description ?? null, transportStatus: transport?.status ?? null,
    status: normalizeStatus(task.status), priority: normalizePriority(task.priority), message: task.message, description: task.description,
    assignedUserId: task.assignedUserId, assignedName: assigned?.name ?? `Bruker #${task.assignedUserId}`, assignedWannabeId: assigned?.wannabeId ?? null,
    createdByUserId: task.createdByUserId, createdByName: creator?.name ?? `Bruker #${task.createdByUserId}`,
    dueAt: task.dueAt.toISOString(), completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString(),
  };
}

function compareTasks(left: BifrostTask, right: BifrostTask): number {
  const completed = Number(left.status === "completed") - Number(right.status === "completed");
  if (completed !== 0) return completed;
  if (left.priority !== right.priority) return right.priority - left.priority;
  return left.dueAt.localeCompare(right.dueAt);
}

function normalizeStatus(value: string): TaskStatus { return ["not_started", "in_progress", "blocked", "completed"].includes(value) ? value as TaskStatus : "not_started"; }
function normalizePriority(value: number): TaskPriority { return value === 1 || value === 3 ? value : 2; }
function plainTitle(value: string): string { return value.replace(/<[^>]*>/g, "").trim().slice(0, 180); }
function nullableText(value: string | null | undefined, limit: number): string | null { const text = (value ?? "").trim().slice(0, limit); return text || null; }
async function writeAudit(tx: DatabaseTransaction, actorUserId: number, action: string, entityType: string, entityId: number, diff: unknown): Promise<void> { await tx.insert(auditLogs).values({ actorUserId, action, entityType, entityId, diffJson: diff, createdAt: new Date() }); }
