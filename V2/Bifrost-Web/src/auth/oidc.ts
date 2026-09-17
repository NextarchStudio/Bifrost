import type { OidcSessionResponse } from "@bifrost/contracts";
import { completeOidcLogin, startOidcLogin } from "../api/client";

export async function beginSignIn(): Promise<void> {
  const { authorizationUrl } = await startOidcLogin(window.location.origin);
  window.location.assign(authorizationUrl);
}

export async function completeSignIn(): Promise<OidcSessionResponse> {
  const query = new URLSearchParams(window.location.search);
  const providerError = query.get("error_description") || query.get("error");
  if (providerError) throw new Error(`Keycloak avbrøt innloggingen: ${providerError}`);

  const code = query.get("code");
  const state = query.get("state");
  if (!code || !state) throw new Error("Keycloak-callback mangler code eller state.");
  return completeOidcLogin({ code, state });
}
