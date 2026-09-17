import type { CurrentUser, OidcPublicConfig } from "@bifrost/contracts";
import {
  authAccounts,
  localSessions,
  roles,
  systemSettings,
  userRoles,
  users,
  type DatabaseConnection,
} from "@bifrost/database";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { hashLocalSessionToken, isLocalSessionToken } from "./local-session.js";
import { isActiveWebOrigin } from "../settings/web-origins.js";

export class AuthenticationError extends Error {
  constructor(message: string, readonly statusCode: 401 | 403 | 429 | 503 = 401) {
    super(message);
  }
}

export interface AuthService {
  getPublicConfig(webOrigin?: string): Promise<OidcPublicConfig>;
  authenticate(token: string): Promise<CurrentUser>;
}

type VerifyToken = (token: string, config: OidcPublicConfig) => Promise<JWTPayload>;

export function createAuthService(database: DatabaseConnection, verifyToken: VerifyToken = verifyKeycloakToken): AuthService {
  const getPublicConfig = async (webOrigin?: string): Promise<OidcPublicConfig> => {
    const normalizedOrigin = normalizeWebOrigin(webOrigin);
    const [settingsRows, allowedOrigin] = await Promise.all([
      database.db
        .select({
          enabled: systemSettings.enableKeycloakLogin,
          baseUrl: systemSettings.keycloakBaseUrl,
          realm: systemSettings.keycloakRealm,
          clientId: systemSettings.keycloakClientId,
          redirectUri: systemSettings.keycloakRedirectUri,
          localLoginEnabled: systemSettings.enableLocalLogin,
          appName: systemSettings.appName,
          logoUrl: systemSettings.logoUrl,
          faviconUrl: systemSettings.faviconUrl,
        })
        .from(systemSettings)
        .where(eq(systemSettings.id, 1))
        .limit(1),
      normalizedOrigin ? isActiveWebOrigin(database, normalizedOrigin) : Promise.resolve(false),
    ]);
    const [settings] = settingsRows;

    if (!settings?.enabled || !settings.baseUrl || !settings.realm || !settings.clientId || !settings.redirectUri) {
      throw new AuthenticationError("Keycloak/OIDC er ikke konfigurert.", 503);
    }

    return {
      authority: `${settings.baseUrl.replace(/\/$/, "")}/realms/${encodeURIComponent(settings.realm)}`,
      clientId: settings.clientId,
      redirectUri: allowedOrigin ? `${normalizedOrigin}/auth/callback` : settings.redirectUri,
      scope: "openid profile email",
      localLoginEnabled: settings.localLoginEnabled,
      appName: settings.appName?.trim() || "Bifrost",
      logoUrl: settings.logoUrl?.trim() || null,
      faviconUrl: settings.faviconUrl?.trim() || null,
    };
  };

  return {
    getPublicConfig,
    async authenticate(token: string): Promise<CurrentUser> {
      try {
        if (isLocalSessionToken(token)) return await loadLocalSessionUser(token);

        const config = await getPublicConfig();
        let claims: JWTPayload;
        try {
          claims = await verifyToken(token, config);
        } catch (error) {
          if (error instanceof AuthenticationError) throw error;
          throw new AuthenticationError("Token kunne ikke valideres.");
        }
        if (!claims.sub) throw new AuthenticationError("Token mangler brukeridentitet.");

        let rows = await loadUser(claims.sub);
        if (rows.length === 0) {
          await provisionUser(database, claims);
          rows = await loadUser(claims.sub);
        }

        const first = rows[0];
        if (!first) throw new AuthenticationError("Brukeren kunne ikke opprettes i Bifrost.", 403);

        return {
          id: first.id,
          name: first.name,
          firstName: first.firstName,
          lastName: first.lastName,
          email: first.email,
          wannabeId: first.wannabeId,
          roles: [...new Set(rows.flatMap((row) => row.role ? [row.role] : []))],
        };
      } catch (error) {
        if (error instanceof AuthenticationError) throw error;
        throw new AuthenticationError("Innloggingstjenesten er utilgjengelig.", 503);
      }
    },
  };

  async function loadUser(providerId: string) {
    return database.db
        .select({
          id: users.id,
          name: users.name,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          wannabeId: users.wannabeId,
          role: roles.name,
        })
        .from(authAccounts)
        .innerJoin(users, eq(authAccounts.userId, users.id))
        .leftJoin(userRoles, eq(userRoles.userId, users.id))
        .leftJoin(roles, eq(roles.id, userRoles.roleId))
        .where(and(
          eq(authAccounts.provider, "keycloak"),
          eq(authAccounts.providerId, providerId),
          eq(users.active, true),
        ));
  }

  async function loadLocalSessionUser(token: string): Promise<CurrentUser> {
    const rows = await database.db
      .select({
        sessionId: localSessions.id,
        id: users.id,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        wannabeId: users.wannabeId,
        role: roles.name,
      })
      .from(localSessions)
      .innerJoin(users, eq(users.id, localSessions.userId))
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(
        eq(localSessions.tokenHash, hashLocalSessionToken(token)),
        isNull(localSessions.revokedAt),
        gt(localSessions.expiresAt, new Date()),
        eq(users.active, true),
      ));

    const first = rows[0];
    if (!first) throw new AuthenticationError("Den lokale økten er utløpt eller ugyldig.");

    await database.db.update(localSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(localSessions.id, first.sessionId));

    return {
      id: first.id,
      name: first.name,
      firstName: first.firstName,
      lastName: first.lastName,
      email: first.email,
      wannabeId: first.wannabeId,
      roles: [...new Set(rows.flatMap((row) => row.role ? [row.role] : []))],
    };
  }
}

export function normalizeWebOrigin(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!(["http:", "https:"] as const).includes(url.protocol as "http:" | "https:")) return undefined;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

async function provisionUser(database: DatabaseConnection, claims: JWTPayload): Promise<void> {
  const providerId = claims.sub;
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!providerId || !email) throw new AuthenticationError("Keycloak returnerte ikke nødvendig brukerdata.", 403);

  const displayName = claimString(claims.name) || claimString(claims.preferred_username) || email;
  const [firstName, lastName] = splitName(displayName);
  const wannabeId = extractWannabeId(claims);
  const externalRoles = extractRoleNames(claims);

  await database.db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: users.id, active: users.active, wannabeId: users.wannabeId })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing && !existing.active) throw new AuthenticationError("Brukeren er deaktivert.", 403);

    let userId = existing?.id;
    if (!userId) {
      const [created] = await tx.insert(users).values({
        name: displayName.slice(0, 120),
        firstName,
        lastName,
        email: email.slice(0, 180),
        wannabeId,
        passwordHash: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).$returningId();
      userId = created?.id;
    } else if (wannabeId && existing?.wannabeId !== wannabeId) {
      await tx.update(users).set({ wannabeId, updatedAt: new Date() }).where(eq(users.id, userId));
    }

    if (!userId) throw new AuthenticationError("Brukeren kunne ikke opprettes.", 503);

    await tx.insert(authAccounts).values({ userId, provider: "keycloak", providerId });

    const roleFilters = externalRoles.length > 0
      ? inArray(roles.wannabeRoleName, externalRoles)
      : eq(roles.name, "bruker");
    const mappedRoles = await tx
      .select({ id: roles.id, name: roles.name })
      .from(roles)
      .where(roleFilters);
    const defaultRole = mappedRoles.some((role) => role.name === "bruker")
      ? []
      : await tx.select({ id: roles.id, name: roles.name }).from(roles).where(eq(roles.name, "bruker")).limit(1);

    for (const role of [...mappedRoles, ...defaultRole]) {
      await tx.insert(userRoles).values({ userId, roleId: role.id }).onDuplicateKeyUpdate({ set: { userId } });
    }
  });
}

function claimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function splitName(value: string): [string, string] {
  const parts = value.replace(/\s+/g, " ").trim().split(" ");
  const firstName = (parts.shift() || "Unknown").slice(0, 80);
  return [firstName, parts.join(" ").slice(0, 80)];
}

export function extractWannabeId(claims: JWTPayload): number | null {
  const record = claims as Record<string, unknown>;
  const candidates = [
    "wannabe_id", "wannabeId", "member_number", "memberNumber", "person_id", "personId",
    "uid", "uidNumber", "employeeNumber", "preferred_username", "nickname", "username", "upn", "email",
  ];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
    if (typeof value === "string") {
      const match = value.match(/\b(\d{4,})\b/);
      if (match) return Number(match[1]);
    }
  }
  return null;
}

export function extractRoleNames(claims: JWTPayload): string[] {
  const record = claims as Record<string, unknown>;
  const values = [record.role, record.roles, record.crew_role, record.crewRole, record.crew_role_name, record.crew_role_title];
  const names: string[] = [];
  for (const value of values) collectRoleNames(value, names);
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

function collectRoleNames(value: unknown, target: string[]): void {
  if (typeof value === "string") target.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => collectRoleNames(entry, target));
  else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    collectRoleNames(record.title, target);
    collectRoleNames(record.name, target);
  }
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function verifyKeycloakToken(token: string, config: OidcPublicConfig): Promise<JWTPayload> {
  const jwksUrl = `${config.authority}/protocol/openid-connect/certs`;
  let keySet = keySets.get(jwksUrl);
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(jwksUrl));
    keySets.set(jwksUrl, keySet);
  }

  const { payload } = await jwtVerify(token, keySet, { issuer: config.authority });
  const audiences = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  if (!audiences.includes(config.clientId) && payload.azp !== config.clientId) {
    throw new AuthenticationError("Token er ikke utstedt for Bifrost.");
  }
  return payload;
}
