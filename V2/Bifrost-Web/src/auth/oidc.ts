import type { OidcPublicConfig } from "@bifrost/contracts";
import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import { createHeaders, getApiUrl } from "../api/client";

let managerPromise: Promise<UserManager> | undefined;

export function getUserManager(): Promise<UserManager> {
  managerPromise ??= fetch(`${getApiUrl()}/api/v1/auth/config`, { headers: createHeaders() })
    .then(async (response) => {
      if (!response.ok) throw new Error("OIDC-konfigurasjonen er ikke tilgjengelig.");
      const config = await response.json() as OidcPublicConfig;
      return new UserManager({
        authority: config.authority,
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: config.scope,
        userStore: new WebStorageStateStore({ store: window.sessionStorage }),
        stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
        loadUserInfo: true,
      });
    });
  return managerPromise;
}

export async function beginSignIn(): Promise<void> {
  await (await getUserManager()).signinRedirect();
}

export async function completeSignIn(): Promise<User> {
  return (await getUserManager()).signinRedirectCallback();
}

export async function getSignedInUser(): Promise<User | null> {
  return (await getUserManager()).getUser();
}

export async function signOut(): Promise<void> {
  const manager = await getUserManager();
  await manager.removeUser();
  window.location.assign("/");
}
