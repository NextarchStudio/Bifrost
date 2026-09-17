import type {
  CurrentUser,
  OidcCallbackRequest,
  OidcPublicConfig,
  OidcSessionResponse,
  OidcStartRequest,
  OidcStartResponse,
} from "@bifrost/contracts";
import type { JWTPayload } from "jose";
import { createHash, randomBytes } from "node:crypto";
import type { SecureSettingsStore } from "../settings/secure-settings.js";
import type { AuthLoginService } from "./login-audit.js";
import type { IssuedLocalSession } from "./local-session.js";
import { AuthenticationError, normalizeWebOrigin, type AuthService, verifyKeycloakToken } from "./service.js";

const FLOW_TTL_MS = 10 * 60 * 1_000;
const MAX_PENDING_FLOWS = 2_000;
const OIDC_CLIENT_SECRET_KEY = "oidc.client_secret";
export const OIDC_FLOW_COOKIE_NAME = "bifrost_oidc_flow";
export const OIDC_FLOW_COOKIE_PATH = "/api/v1/auth/oidc/callback";

interface PendingFlow {
  config: OidcPublicConfig;
  browserBindingHash: string;
  codeVerifier: string;
  nonce: string;
  expiresAt: number;
}

interface TokenResponse {
  id_token?: unknown;
  error?: unknown;
}

type FetchImplementation = typeof globalThis.fetch;
type VerifyIdToken = (token: string, config: OidcPublicConfig) => Promise<JWTPayload>;
type IssueSession = (userId: number, now: Date) => Promise<IssuedLocalSession>;

export interface ConfidentialOidcService {
  start(input: OidcStartRequest): Promise<OidcStartResponse & { browserBinding: string; secureCookie: boolean }>;
  complete(
    input: OidcCallbackRequest,
    ipAddress: string,
    browserBinding?: string,
  ): Promise<OidcSessionResponse & { accessToken: string; secureCookie: boolean }>;
}

export function createConfidentialOidcService(
  auth: AuthService,
  login: AuthLoginService,
  secureSettings: SecureSettingsStore,
  issueSession: IssueSession,
  options: {
    fetchImplementation?: FetchImplementation;
    verifyIdToken?: VerifyIdToken;
    now?: () => Date;
  } = {},
): ConfidentialOidcService {
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const verifyIdToken = options.verifyIdToken ?? verifyKeycloakToken;
  const now = options.now ?? (() => new Date());
  const pendingFlows = new Map<string, PendingFlow>();

  return {
    async start(input) {
      cleanupExpiredFlows(pendingFlows, now().getTime());
      if (pendingFlows.size >= MAX_PENDING_FLOWS) {
        throw new AuthenticationError("For mange pågående innlogginger. Prøv igjen om noen minutter.", 429);
      }

      await requireClientSecret(secureSettings);
      const origin = normalizeWebOrigin(input.origin);
      if (!origin) throw new AuthenticationError("Ugyldig Web-adresse.", 403);

      const config = await auth.getPublicConfig(origin);
      const redirectUri = validateRedirectUri(config.redirectUri, origin);
      const authority = validateAuthority(config.authority);
      const state = randomValue();
      const nonce = randomValue();
      const codeVerifier = randomValue(48);
      const browserBinding = randomValue();
      const codeChallenge = createHash("sha256").update(codeVerifier, "ascii").digest("base64url");

      const authorizationUrl = new URL(`${authority}/protocol/openid-connect/auth`);
      authorizationUrl.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: config.scope,
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      }).toString();

      pendingFlows.set(hashState(state), {
        config: { ...config, authority, redirectUri },
        browserBindingHash: hashState(browserBinding),
        codeVerifier,
        nonce,
        expiresAt: now().getTime() + FLOW_TTL_MS,
      });
      return {
        authorizationUrl: authorizationUrl.toString(),
        browserBinding,
        secureCookie: redirectUri.startsWith("https://"),
      };
    },

    async complete(input, ipAddress, browserBinding) {
      const flowKey = hashState(input.state);
      const flow = pendingFlows.get(flowKey);
      if (!flow || flow.expiresAt <= now().getTime()) {
        pendingFlows.delete(flowKey);
        throw new AuthenticationError("Innloggingsforsøket er utløpt eller allerede brukt.");
      }
      if (!browserBinding || hashState(browserBinding) !== flow.browserBindingHash) {
        throw new AuthenticationError("Innloggingsforsøket tilhører ikke denne nettleseren.");
      }
      pendingFlows.delete(flowKey);

      const clientSecret = await requireClientSecret(secureSettings);
      const tokenEndpoint = `${flow.config.authority}/protocol/openid-connect/token`;
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: flow.config.clientId,
        client_secret: clientSecret,
        redirect_uri: flow.config.redirectUri,
        code: input.code,
        code_verifier: flow.codeVerifier,
      });

      let response: Response;
      try {
        response = await fetchImplementation(tokenEndpoint, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        throw new AuthenticationError("Keycloak kunne ikke nås.", 503);
      }

      const tokenResponse = await readTokenResponse(response);
      if (!response.ok) {
        const errorCode = typeof tokenResponse.error === "string" ? tokenResponse.error : "";
        const status = errorCode === "invalid_grant" ? 401 : 503;
        throw new AuthenticationError(
          status === 503 ? "Keycloak avviste klientautentiseringen." : "Keycloak avviste innloggingskoden.",
          status,
        );
      }
      if (typeof tokenResponse.id_token !== "string" || !tokenResponse.id_token) {
        throw new AuthenticationError("Keycloak returnerte ikke en gyldig identitet.", 503);
      }

      let claims: JWTPayload;
      try {
        claims = await verifyIdToken(tokenResponse.id_token, flow.config);
      } catch (error) {
        if (error instanceof AuthenticationError) throw error;
        throw new AuthenticationError("Identiteten fra Keycloak kunne ikke valideres.");
      }
      if (claims.nonce !== flow.nonce) throw new AuthenticationError("Innloggingen hadde ugyldig nonce.");

      const user: CurrentUser = await login.complete(tokenResponse.id_token, ipAddress);
      let session: IssuedLocalSession;
      try {
        session = await issueSession(user.id, now());
      } catch {
        throw new AuthenticationError("Bifrost-økten kunne ikke opprettes.", 503);
      }

      return {
        accessToken: session.accessToken,
        expiresAt: session.expiresAt.toISOString(),
        secureCookie: flow.config.redirectUri.startsWith("https://"),
        user,
      };
    },
  };
}

export function readOidcFlowCookie(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0 || segment.slice(0, separator).trim() !== OIDC_FLOW_COOKIE_NAME) continue;
    try {
      const value = decodeURIComponent(segment.slice(separator + 1).trim());
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function serializeOidcFlowCookie(value: string, secure: boolean): string {
  return serializeFlowCookie(value, FLOW_TTL_MS / 1_000, secure);
}

export function serializeClearedOidcFlowCookie(secure: boolean): string {
  return serializeFlowCookie("", 0, secure);
}

function serializeFlowCookie(value: string, maxAge: number, secure: boolean): string {
  return [
    `${OIDC_FLOW_COOKIE_NAME}=${encodeURIComponent(value)}`,
    `Path=${OIDC_FLOW_COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
    maxAge === 0 ? "Expires=Thu, 01 Jan 1970 00:00:00 GMT" : "",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

function randomValue(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function hashState(state: string): string {
  return createHash("sha256").update(state, "utf8").digest("hex");
}

function cleanupExpiredFlows(flows: Map<string, PendingFlow>, currentTime: number): void {
  for (const [key, flow] of flows) {
    if (flow.expiresAt <= currentTime) flows.delete(key);
  }
}

async function requireClientSecret(secureSettings: SecureSettingsStore): Promise<string> {
  let secret: string | null;
  try {
    secret = await secureSettings.get(OIDC_CLIENT_SECRET_KEY);
  } catch {
    throw new AuthenticationError("Den krypterte Keycloak-hemmeligheten kunne ikke leses.", 503);
  }
  if (!secret?.trim()) throw new AuthenticationError("Keycloak client secret er ikke konfigurert kryptert.", 503);
  return secret;
}

function validateRedirectUri(value: string, origin: string): string {
  try {
    const redirect = new URL(value);
    if (redirect.origin !== origin || redirect.pathname !== "/auth/callback" || redirect.search || redirect.hash) throw new Error("invalid");
    return redirect.toString();
  } catch {
    throw new AuthenticationError("OIDC callback er ikke tillatt for dette domenet.", 403);
  }
}

function validateAuthority(value: string): string {
  try {
    const authority = new URL(value);
    const local = authority.hostname === "localhost" || authority.hostname === "127.0.0.1";
    if (authority.protocol !== "https:" && !(local && authority.protocol === "http:")) throw new Error("invalid");
    if (authority.username || authority.password || authority.search || authority.hash) throw new Error("invalid");
    return authority.toString().replace(/\/$/, "");
  } catch {
    throw new AuthenticationError("Keycloak-adressen er ugyldig.", 503);
  }
}

async function readTokenResponse(response: Response): Promise<TokenResponse> {
  try {
    const body: unknown = await response.json();
    return body && typeof body === "object" ? body as TokenResponse : {};
  } catch {
    return {};
  }
}
