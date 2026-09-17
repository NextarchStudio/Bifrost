import type { CrewProfile } from "@bifrost/contracts";
import { crewDirectoryCache, systemSettings, users, type DatabaseConnection } from "@bifrost/database";
import { eq, or } from "drizzle-orm";
import { Buffer } from "node:buffer";
import type { SecureSettingsStore } from "../settings/secure-settings.js";

interface CrewApiProfile {
  id?: unknown;
  name?: unknown;
  first_name?: unknown;
  firstName?: unknown;
  given_name?: unknown;
  givenName?: unknown;
  last_name?: unknown;
  lastName?: unknown;
  family_name?: unknown;
  familyName?: unknown;
  email?: unknown;
  mail?: unknown;
  email_address?: unknown;
  nickname?: unknown;
  nick?: unknown;
  crew_name?: unknown;
  crew?: unknown;
  role?: unknown;
  rolle?: unknown;
  crew_role?: unknown;
}

interface NormalizedProfile {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  nickname: string;
  crewName: string;
  roleTitle: string;
  roleName: string;
}

export class CrewDirectoryError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "NOT_CONFIGURED") { super(message); }
}

export interface CrewDirectoryService {
  lookup(query: string, mode?: "auto" | "wannabe" | "badge", refresh?: boolean): Promise<CrewProfile>;
  picture(wannabeId: number): Promise<{ contentType: string; body: Buffer } | null>;
}

export function createCrewDirectoryService(
  database: DatabaseConnection,
  secureSettings: SecureSettingsStore,
  fetchImplementation: typeof fetch = fetch,
): CrewDirectoryService {
  return {
    async lookup(query, mode = "auto", refresh = false) {
      await ensureFreshCacheYear(database);
      const isNumeric = /^\d+$/.test(query);
      const attempts: Array<"wannabe" | "badge"> = mode === "wannabe" ? ["wannabe"] : mode === "badge" ? ["badge"] : isNumeric ? ["wannabe", "badge"] : ["badge"];
      const config = await loadConfig(database, secureSettings);
      for (const attempt of attempts) {
        const wannabeId = attempt === "wannabe" ? Number(query) : null;
        if (attempt === "wannabe" && (!Number.isSafeInteger(wannabeId) || wannabeId! < 1)) continue;
        if (!refresh) {
          const [cached] = await database.db.select().from(crewDirectoryCache)
            .where(attempt === "wannabe" ? eq(crewDirectoryCache.wannabeId, wannabeId!) : eq(crewDirectoryCache.scanNumber, query)).limit(1);
          if (cached?.name && cached.wannabeId > 0) return toPublicProfile({
            id: cached.wannabeId,
            name: cached.name,
            firstName: "",
            lastName: "",
            email: "",
            nickname: cached.nickname ?? "",
            crewName: cached.crewName ?? "",
            roleTitle: cached.crewRoleTitle ?? "",
            roleName: cached.crewRoleName ?? "",
          }, "cache");
        }
        if (config) {
          const remote = await fetchRemoteProfile(config, attempt === "wannabe" ? "uid" : "sn", query, fetchImplementation);
          if (remote) {
            await saveProfile(database, remote, attempt === "badge" ? query : null);
            return toPublicProfile(remote, "remote");
          }
        }
        const [local] = await database.db.select({
          id: users.wannabeId,
          name: users.name,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        }).from(users)
          .where(attempt === "wannabe" ? eq(users.wannabeId, wannabeId!) : eq(users.badgeScanNumber, query)).limit(1);
        if (local?.id && local.name) return {
          id: local.id,
          name: local.name,
          firstName: local.firstName,
          lastName: local.lastName,
          email: local.email,
          nickname: "",
          crewName: "",
          role: "",
          roleName: null,
          displayName: local.name,
          source: "local",
        };
      }
      if (!config) throw new CrewDirectoryError("Crew-oppslag er ikke konfigurert.", "NOT_CONFIGURED");
      throw new CrewDirectoryError("Fant ikke person for denne Wannabe-ID-en eller badge-scannen.", "NOT_FOUND");
    },

    async picture(wannabeId) {
      const config = await loadPictureConfig(database, secureSettings);
      if (!config) return null;
      try {
        const base = config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`;
        const url = new URL(config.pictureEndpoint.replace(/^\//, ""), base);
        if (!new Set(["http:", "https:"]).has(url.protocol)) return null;
        url.searchParams.set("uid", String(wannabeId));
        const response = await fetchImplementation(url, {
          headers: { Authorization: `Bearer ${config.token}`, Accept: "image/png,image/jpeg,image/webp,image/gif" },
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) return null;
        const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "image/png";
        if (!new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]).has(contentType)) return null;
        const body = Buffer.from(await response.arrayBuffer());
        return body.length > 0 ? { contentType, body } : null;
      } catch {
        return null;
      }
    },
  };
}

async function loadConfig(database: DatabaseConnection, secureSettings: SecureSettingsStore) {
  const [settings] = await database.db.select({
    baseUrl: systemSettings.crewApiBaseUrl,
    profileEndpoint: systemSettings.crewApiProfileEndpoint,
  }).from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
  const token = await secureSettings.get("crew.api_bearer_token");
  if (!settings?.baseUrl || !settings.profileEndpoint || !token) return null;
  return { baseUrl: settings.baseUrl, profileEndpoint: settings.profileEndpoint, token };
}

async function loadPictureConfig(database: DatabaseConnection, secureSettings: SecureSettingsStore) {
  const [settings] = await database.db.select({
    baseUrl: systemSettings.crewApiBaseUrl,
    pictureEndpoint: systemSettings.crewApiPictureEndpoint,
  }).from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
  const token = await secureSettings.get("crew.api_bearer_token");
  if (!settings?.baseUrl || !settings.pictureEndpoint || !token) return null;
  return { baseUrl: settings.baseUrl, pictureEndpoint: settings.pictureEndpoint, token };
}

async function fetchRemoteProfile(
  config: { baseUrl: string; profileEndpoint: string; token: string },
  queryKey: "uid" | "sn",
  queryValue: string,
  fetchImplementation: typeof fetch,
): Promise<NormalizedProfile | null> {
  let url: URL;
  try {
    const base = config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`;
    url = new URL(config.profileEndpoint.replace(/^\//, ""), base);
    if (!new Set(["http:", "https:"]).has(url.protocol)) return null;
    url.searchParams.set(queryKey, queryValue);
    const response = await fetchImplementation(url, {
      headers: { Authorization: `Bearer ${config.token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    return normalizeCrewProfile(await response.json() as CrewApiProfile);
  } catch {
    return null;
  }
}

export function normalizeCrewProfile(profile: CrewApiProfile): NormalizedProfile | null {
  const id = typeof profile.id === "number" ? profile.id : typeof profile.id === "string" ? Number(profile.id) : 0;
  let firstName = firstString(profile.first_name, profile.firstName, profile.given_name, profile.givenName);
  let lastName = firstString(profile.last_name, profile.lastName, profile.family_name, profile.familyName);
  const name = stringValue(profile.name) || [firstName, lastName].filter(Boolean).join(" ");
  if (!Number.isSafeInteger(id) || id < 1 || !name) return null;
  if (!firstName && !lastName) ({ firstName, lastName } = splitPersonName(name));
  const role = profile.crew_role && typeof profile.crew_role === "object" ? profile.crew_role as Record<string, unknown> : {};
  return {
    id,
    name,
    firstName,
    lastName,
    email: normalizeEmail(firstString(profile.email, profile.mail, profile.email_address)),
    nickname: stringValue(profile.nickname) || stringValue(profile.nick),
    crewName: stringValue(profile.crew_name) || stringValue(profile.crew),
    roleTitle: stringValue(role.title) || stringValue(profile.role) || stringValue(profile.rolle),
    roleName: stringValue(role.name),
  };
}

async function saveProfile(database: DatabaseConnection, profile: NormalizedProfile, scanNumber: string | null): Promise<void> {
  await database.db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: crewDirectoryCache.id, scanNumber: crewDirectoryCache.scanNumber })
      .from(crewDirectoryCache).where(or(
        eq(crewDirectoryCache.wannabeId, profile.id),
        ...(scanNumber ? [eq(crewDirectoryCache.scanNumber, scanNumber)] : []),
      )).limit(1);
    const now = new Date();
    const values = {
      wannabeId: profile.id,
      scanNumber: scanNumber || existing?.scanNumber || null,
      name: profile.name,
      nickname: profile.nickname || null,
      crewName: profile.crewName || null,
      crewRoleTitle: profile.roleTitle || null,
      crewRoleName: profile.roleName || null,
      updatedAt: now,
    };
    if (existing) await tx.update(crewDirectoryCache).set(values).where(eq(crewDirectoryCache.id, existing.id));
    else await tx.insert(crewDirectoryCache).values({ ...values, createdAt: now });
    if (scanNumber) await tx.update(users).set({ badgeScanNumber: scanNumber, updatedAt: now }).where(eq(users.wannabeId, profile.id));
  });
}

async function ensureFreshCacheYear(database: DatabaseConnection): Promise<void> {
  const currentYear = new Date().getFullYear();
  const [settings] = await database.db.select({ year: systemSettings.crewCacheYear })
    .from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
  if (settings?.year === currentYear) return;
  await database.db.transaction(async (tx) => {
    await tx.delete(crewDirectoryCache);
    await tx.update(users).set({ badgeScanNumber: null });
    await tx.update(systemSettings).set({ crewCacheYear: currentYear }).where(eq(systemSettings.id, 1));
  });
}

function toPublicProfile(profile: NormalizedProfile, source: "cache" | "remote"): CrewProfile {
  const displayName = profile.name || profile.nickname || `Wannabe ${profile.id}`;
  return {
    id: profile.id,
    name: profile.name,
    firstName: profile.firstName || null,
    lastName: profile.lastName || null,
    email: profile.email || null,
    nickname: profile.nickname,
    crewName: profile.crewName,
    role: profile.roleTitle,
    roleName: profile.roleName || null,
    displayName,
    source,
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = stringValue(value);
    if (normalized) return normalized;
  }
  return "";
}

function splitPersonName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) ?? "" };
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 180) : "";
}
