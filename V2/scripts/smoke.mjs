const webBase = normalizedBase(process.env.BIFROST_WEB_URL ?? "http://127.0.0.1:3000");
const apiBase = normalizedBase(process.env.BIFROST_API_URL ?? "http://127.0.0.1:3001");
const webOrigin = new URL(webBase).origin;
const apiOrigin = new URL(apiBase).origin;
let failures = 0;

await check("Web", webBase, async (response) => {
  assert(response.ok, `HTTP ${response.status}`);
  assert((response.headers.get("content-type") ?? "").includes("text/html"), "forventet HTML");
});

await check("API health", `${apiBase}/health`, async (response) => {
  assert(response.ok, `HTTP ${response.status}`);
  const body = await response.json();
  assert(body.service === "bifrost-api" && body.status === "ok", "ugyldig health-respons");
});

await check("API readiness", `${apiBase}/ready`, async (response) => {
  assert(response.ok, `HTTP ${response.status}`);
  const body = await response.json();
  assert(body.status === "ready" && body.database === "connected", "databasen er ikke klar");
});

await check("OIDC callback", `${apiBase}/api/v1/auth/config?origin=${encodeURIComponent(webOrigin)}`, async (response) => {
  assert(response.ok, `HTTP ${response.status}`);
  const body = await response.json();
  assert(body.redirectUri === `${webOrigin}/auth/callback`, `fikk ${body.redirectUri ?? "ingen redirect URI"}`);
  const authority = new URL(body.authority);
  assert(authority.protocol === "https:" || (authority.protocol === "http:" && ["127.0.0.1", "localhost"].includes(authority.hostname)), "OIDC authority må bruke HTTPS utenfor lokalmiljøet");
});

await check("Confidential OIDC-start", `${apiBase}/api/v1/auth/oidc/start`, async (response) => {
  assert(response.ok, `HTTP ${response.status}`);
  const body = await response.json();
  const authorizationUrl = new URL(body.authorizationUrl);
  assert(authorizationUrl.searchParams.get("redirect_uri") === `${webOrigin}/auth/callback`, "OIDC-start bruker feil callback");
  assert(authorizationUrl.searchParams.get("code_challenge_method") === "S256", "PKCE S256 mangler");
  assert(Boolean(authorizationUrl.searchParams.get("state")), "OIDC state mangler");
  assert(Boolean(authorizationUrl.searchParams.get("nonce")), "OIDC nonce mangler");
}, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Bifrost-Request": "web" },
  body: JSON.stringify({ origin: webOrigin }),
});

await check("CORS mutasjoner", `${apiBase}/api/v1/locations/1`, async (response) => {
  assert(response.status === 204, `HTTP ${response.status}`);
  if (apiOrigin !== webOrigin) assert(response.headers.get("access-control-allow-origin") === webOrigin, "origin er ikke tillatt");
  const methods = response.headers.get("access-control-allow-methods") ?? "";
  for (const method of ["PUT", "PATCH", "DELETE"]) assert(methods.includes(method), `${method} mangler`);
}, {
  method: "OPTIONS",
  headers: { Origin: webOrigin, "Access-Control-Request-Method": "PATCH", "Access-Control-Request-Headers": "authorization,content-type,x-bifrost-request" },
});

if (failures > 0) {
  console.error(`Smoke-test feilet: ${failures} kontroll(er).`);
  process.exitCode = 1;
} else {
  console.info(`Smoke-test bestått for Web ${webBase} og API ${apiBase}.`);
}

async function check(name, url, verify, init) {
  try {
    const response = await fetch(url, { ...init, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    await verify(response);
    console.info(`PASS  ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${name}: ${error instanceof Error ? error.message : "ukjent feil"}`);
  }
}

function normalizedBase(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error(`Ugyldig base-URL: ${value}`);
  return url.toString().replace(/\/$/, "");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
