import type { CurrentUser, OidcPublicConfig } from "@bifrost/contracts";
import {
  authAccounts,
  roles,
  systemSettings,
  userRoles,
  users,
  type DatabaseConnection,
} from "@bifrost/database";
import { and, eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export class AuthenticationError extends Error {
  constructor(message: string, readonly statusCode: 401 | 403 | 503 = 401) {
    super(message);
  }
}

export interface AuthService {
  getPublicConfig(): Promise<OidcPublicConfig>;
  authenticate(token: string): Promise<CurrentUser>;
}

type VerifyToken = (token: string, config: OidcPublicConfig) => Promise<JWTPayload>;

export function createAuthService(database: DatabaseConnection, verifyToken: VerifyToken = verifyKeycloakToken): AuthService {
  const getPublicConfig = async (): Promise<OidcPublicConfig> => {
    const [settings] = await database.db
      .select({
        enabled: systemSettings.enableKeycloakLogin,
        baseUrl: systemSettings.keycloakBaseUrl,
        realm: systemSettings.keycloakRealm,
        clientId: systemSettings.keycloakClientId,
        redirectUri: systemSettings.keycloakRedirectUri,
      })
      .from(systemSettings)
      .where(eq(systemSettings.id, 1))
      .limit(1);

    if (!settings?.enabled || !settings.baseUrl || !settings.realm || !settings.clientId || !settings.redirectUri) {
      throw new AuthenticationError("Keycloak/OIDC er ikke konfigurert.", 503);
    }

    return {
      authority: `${settings.baseUrl.replace(/\/$/, "")}/realms/${encodeURIComponent(settings.realm)}`,
      clientId: settings.clientId,
      redirectUri: settings.redirectUri,
      scope: "openid profile email",
    };
  };

  return {
    getPublicConfig,
    async authenticate(token: string): Promise<CurrentUser> {
      const config = await getPublicConfig();
      const claims = await verifyToken(token, config);
      if (!claims.sub) throw new AuthenticationError("Token mangler brukeridentitet.");

      const rows = await database.db
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
          eq(authAccounts.providerId, claims.sub),
          eq(users.active, true),
        ));

      const first = rows[0];
      if (!first) throw new AuthenticationError("Brukeren er ikke aktivert i Bifrost.", 403);

      return {
        id: first.id,
        name: first.name,
        firstName: first.firstName,
        lastName: first.lastName,
        email: first.email,
        wannabeId: first.wannabeId,
        roles: [...new Set(rows.flatMap((row) => row.role ? [row.role] : []))],
      };
    },
  };
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
