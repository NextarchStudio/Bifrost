import type { CurrentUser } from "@bifrost/contracts";
import { auditLogs, loginAttempts, type DatabaseConnection } from "@bifrost/database";
import { and, count, eq, gte } from "drizzle-orm";
import { AuthenticationError, type AuthService } from "./service.js";

const UNKNOWN_OIDC_IDENTITY = "oidc:unknown";
const FAILURE_WINDOW_MS = 15 * 60 * 1_000;
const MAX_FAILED_ATTEMPTS = 5;

export interface AuthLoginService {
  complete(token: string, ipAddress: string): Promise<CurrentUser>;
}

export function createAuthLoginService(database: DatabaseConnection, auth: AuthService): AuthLoginService {
  return {
    async complete(token, ipAddress) {
      const normalizedIp = normalizeIpAddress(ipAddress);
      let user: CurrentUser;

      try {
        user = await auth.authenticate(token);
      } catch (error) {
        if (!(error instanceof AuthenticationError)) {
          throw new AuthenticationError("Innloggingstjenesten er utilgjengelig.", 503);
        }
        if (error.statusCode === 429 || error.statusCode === 503) throw error;

        let recentAttempts: { total: number } | undefined;
        try {
          [recentAttempts] = await database.db
            .select({ total: count() })
            .from(loginAttempts)
            .where(and(
              eq(loginAttempts.email, UNKNOWN_OIDC_IDENTITY),
              eq(loginAttempts.ipAddress, normalizedIp),
              eq(loginAttempts.successful, false),
              gte(loginAttempts.createdAt, new Date(Date.now() - FAILURE_WINDOW_MS)),
            ));
        } catch {
          throw new AuthenticationError("Innloggingsforsøket kunne ikke registreres.", 503);
        }
        if (Number(recentAttempts?.total ?? 0) >= MAX_FAILED_ATTEMPTS) {
          throw new AuthenticationError("For mange innloggingsforsøk. Prøv igjen om 15 minutter.", 429);
        }
        try {
          await database.db.insert(loginAttempts).values({
            email: UNKNOWN_OIDC_IDENTITY,
            ipAddress: normalizedIp,
            successful: false,
            createdAt: new Date(),
          });
        } catch {
          throw new AuthenticationError("Innloggingsforsøket kunne ikke registreres.", 503);
        }
        throw error;
      }

      try {
        await database.db.transaction(async (tx) => {
          const createdAt = new Date();
          await tx.insert(loginAttempts).values({
            email: user.email,
            ipAddress: normalizedIp,
            successful: true,
            createdAt,
          });
          await tx.insert(auditLogs).values({
            actorUserId: user.id,
            action: "login",
            entityType: "user",
            entityId: user.id,
            diffJson: { provider: "keycloak", ip_address: normalizedIp },
            createdAt,
          });
        });
      } catch {
        throw new AuthenticationError("Innloggingen kunne ikke auditeres.", 503);
      }

      return user;
    },
  };
}

export function normalizeIpAddress(ipAddress: string): string {
  return ipAddress.trim().slice(0, 45) || "unknown";
}
