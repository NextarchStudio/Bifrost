import type { CurrentUser, LocalLoginRequest, LocalLoginResponse } from "@bifrost/contracts";
import {
  auditLogs,
  localSessions,
  loginAttempts,
  roles,
  systemSettings,
  userRoles,
  users,
  type DatabaseConnection,
} from "@bifrost/database";
import argon2 from "argon2";
import { and, count, eq, gte } from "drizzle-orm";
import { normalizeIpAddress } from "./login-audit.js";
import {
  hashLocalSessionToken,
  isLocalSessionToken,
  issueLocalSessionToken,
  LOCAL_SESSION_TTL_MS,
} from "./local-session.js";
import { AuthenticationError } from "./service.js";

const FAILURE_WINDOW_MS = 15 * 60 * 1_000;
const MAX_FAILED_ATTEMPTS = 5;
const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=65536,p=1,t=4$e0qifh/aaaxLXOrRTyoftw$kbt3JlR8wCaaL6F+8strajUr1e3GhM51tO9KPMdb8jg";

type VerifyPassword = (hash: string, password: string) => Promise<boolean>;

export interface LocalAuthService {
  login(input: LocalLoginRequest, ipAddress: string): Promise<LocalLoginResponse>;
  logout(token: string): Promise<void>;
}

export function createLocalAuthService(
  database: DatabaseConnection,
  verifyPassword: VerifyPassword = verifyLegacyPassword,
): LocalAuthService {
  return {
    async login(input, ipAddress) {
      try {
        const email = input.email.trim().toLowerCase().slice(0, 180);
        const normalizedIp = normalizeIpAddress(ipAddress);
        const now = new Date();

        const [settings] = await database.db
          .select({ enabled: systemSettings.enableLocalLogin })
          .from(systemSettings)
          .where(eq(systemSettings.id, 1))
          .limit(1);
        if (!settings?.enabled) throw new AuthenticationError("Lokal innlogging er deaktivert.", 403);

        const [recentAttempts] = await database.db
          .select({ total: count() })
          .from(loginAttempts)
          .where(and(
            eq(loginAttempts.email, email),
            eq(loginAttempts.ipAddress, normalizedIp),
            eq(loginAttempts.successful, false),
            gte(loginAttempts.createdAt, new Date(now.getTime() - FAILURE_WINDOW_MS)),
          ));
        if (Number(recentAttempts?.total ?? 0) >= MAX_FAILED_ATTEMPTS) {
          throw new AuthenticationError("For mange innloggingsforsøk. Prøv igjen om 15 minutter.", 429);
        }

        const userRows = await database.db
          .select({
            id: users.id,
            name: users.name,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            wannabeId: users.wannabeId,
            passwordHash: users.passwordHash,
            active: users.active,
            role: roles.name,
          })
          .from(users)
          .leftJoin(userRoles, eq(userRoles.userId, users.id))
          .leftJoin(roles, eq(roles.id, userRoles.roleId))
          .where(eq(users.email, email));

        const first = userRows[0];
        const passwordHash = first?.passwordHash || DUMMY_PASSWORD_HASH;
        let passwordMatches = false;
        try {
          passwordMatches = await verifyPassword(passwordHash, input.password);
        } catch {
          passwordMatches = false;
        }

        if (!first || !first.active || !first.passwordHash || !passwordMatches) {
          await database.db.insert(loginAttempts).values({
            email,
            ipAddress: normalizedIp,
            successful: false,
            createdAt: now,
          });
          throw new AuthenticationError("Ugyldig brukernavn eller passord.");
        }

        const user: CurrentUser = {
          id: first.id,
          name: first.name,
          firstName: first.firstName,
          lastName: first.lastName,
          email: first.email,
          wannabeId: first.wannabeId,
          roles: [...new Set(userRows.flatMap((row) => row.role ? [row.role] : []))],
        };
        let issuedSession: { accessToken: string; expiresAt: Date } | undefined;

        await database.db.transaction(async (tx) => {
          const accessToken = issueLocalSessionToken();
          const expiresAt = new Date(now.getTime() + LOCAL_SESSION_TTL_MS);
          issuedSession = { accessToken, expiresAt };
          await tx.insert(localSessions).values({ userId: user.id, tokenHash: hashLocalSessionToken(accessToken), expiresAt, lastSeenAt: now, createdAt: now });
          await tx.insert(loginAttempts).values({
            email: user.email,
            ipAddress: normalizedIp,
            successful: true,
            createdAt: now,
          });
          await tx.insert(auditLogs).values({
            actorUserId: user.id,
            action: "login",
            entityType: "user",
            entityId: user.id,
            diffJson: { provider: "local", ip_address: normalizedIp },
            createdAt: now,
          });
        });

        if (!issuedSession) throw new AuthenticationError("Innloggingstjenesten er utilgjengelig.", 503);
        return { accessToken: issuedSession.accessToken, expiresAt: issuedSession.expiresAt.toISOString(), user };
      } catch (error) {
        if (error instanceof AuthenticationError) throw error;
        throw new AuthenticationError("Innloggingstjenesten er utilgjengelig.", 503);
      }
    },

    async logout(token) {
      if (!isLocalSessionToken(token)) return;
      try {
        await database.db.update(localSessions)
          .set({ revokedAt: new Date() })
          .where(eq(localSessions.tokenHash, hashLocalSessionToken(token)));
      } catch {
        throw new AuthenticationError("Utloggingen kunne ikke fullføres.", 503);
      }
    },
  };
}

export async function verifyLegacyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
