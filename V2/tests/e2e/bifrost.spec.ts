import { expect, test, type Page, type Request } from "@playwright/test";

type MockResponse = { status?: number; json?: unknown; body?: string };
type ApiOverride = (request: Request, url: URL) => MockResponse | undefined | Promise<MockResponse | undefined>;

const logoUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='32'%3E%3Crect width='80' height='32' rx='8' fill='%236ee7b7'/%3E%3Ctext x='40' y='21' text-anchor='middle' font-family='sans-serif' font-weight='700'%3ETG%3C/text%3E%3C/svg%3E";
const faviconUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' rx='8' fill='%236ee7b7'/%3E%3C/svg%3E";

const currentUser = {
  id: 2,
  name: "E2E Developer",
  firstName: "E2E",
  lastName: "Developer",
  email: "e2e@example.test",
  wannabeId: 8468,
  roles: ["developer", "chief", "co-chief", "logistikk", "skiftleder", "sambandsansvarlig", "shop", "innkjop", "transport_ansvarlig", "bruker"],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem("bifrost.local.access_token", "bfl_e2e_session"));
});

test("viser branding, låst skall og riktig accordion", async ({ page }) => {
  await mockApi(page);
  await page.goto("/dashboard");

  await expect(page).toHaveTitle("Bifrost E2E");
  await expect(page.getByRole("img", { name: "TG logo" })).toBeVisible();
  await expect(page.locator('link[rel~="icon"]')).toHaveAttribute("href", faviconUrl);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();

  const overview = page.getByRole("button", { name: "Oversikt", exact: true });
  const logistics = page.getByRole("button", { name: "Logistikk", exact: true });
  const operations = page.getByRole("button", { name: "Operativ drift", exact: true });
  await expect(overview).toHaveAttribute("aria-expanded", "true");
  await expect(logistics).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "Utstyr", exact: true })).toBeHidden();

  await logistics.click();
  await expect(overview).toHaveAttribute("aria-expanded", "false");
  await expect(logistics).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Dashboard", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Utstyr", exact: true })).toBeVisible();

  await operations.click();
  await expect(logistics).toHaveAttribute("aria-expanded", "false");
  await expect(operations).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Utstyr", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Kjøretøy", exact: true })).toBeVisible();

  const layout = await page.evaluate(() => ({
    viewport: window.innerHeight,
    body: document.body.scrollHeight,
    mainOverflow: getComputedStyle(document.querySelector("main")!).overflowY,
    asideHeight: document.querySelector("aside")!.getBoundingClientRect().height,
    footerBottom: document.querySelector("footer")!.getBoundingClientRect().bottom,
  }));
  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
  expect(layout.mainOverflow).toBe("auto");
  expect(layout.asideHeight).toBeCloseTo(layout.viewport, 0);
  expect(layout.footerBottom).toBeCloseTo(layout.viewport, 0);
});

for (const viewport of [
  { name: "mobil", width: 320, height: 568 },
  { name: "nettbrett", width: 768, height: 1024 },
  { name: "liten PC", width: 1024, height: 768 },
  { name: "vanlig PC", width: 1440, height: 900 },
  { name: "bred skjerm", width: 2560, height: 1440 },
]) {
  test(`holder skallet responsivt på ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockApi(page);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();

    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      bodyHeight: document.body.scrollHeight,
      mainOverflow: getComputedStyle(document.querySelector("main")!).overflowY,
      headerTop: document.querySelector("header")!.getBoundingClientRect().top,
      footerBottom: document.querySelector("footer")!.getBoundingClientRect().bottom,
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.bodyHeight).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.mainOverflow).toBe("auto");
    expect(layout.headerTop).toBeCloseTo(0, 0);
    expect(layout.footerBottom).toBeCloseTo(layout.viewportHeight, 0);

    const menu = page.getByRole("button", { name: "Åpne navigasjon" });
    const sidebar = page.locator("#primary-navigation");
    if (viewport.width < 1280) {
      await expect(menu).toBeVisible();
      const closed = await sidebar.boundingBox();
      expect(closed).not.toBeNull();
      expect(closed!.x + closed!.width).toBeLessThanOrEqual(1);
      await menu.click();
      await expect(menu).toHaveAttribute("aria-expanded", "true");
      await expect(sidebar).toBeInViewport();
      const opened = await sidebar.boundingBox();
      expect(opened).not.toBeNull();
      expect(opened!.x).toBeCloseTo(0, 0);
      expect(opened!.width).toBeLessThanOrEqual(viewport.width);
      await page.getByRole("button", { name: "Lukk meny" }).click();
      await expect(menu).toHaveAttribute("aria-expanded", "false");
    } else {
      await expect(menu).toBeHidden();
      await expect(sidebar).toBeInViewport();
      const box = await sidebar.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeCloseTo(0, 0);
    }
  });
}

test("viser e-postbryter i systeminnstillinger og støtter Wannabe-ID ved provisjonering", async ({ page }) => {
  let settingsBody: Record<string, unknown> | null = null;
  let provisionBody: Record<string, unknown> | null = null;
  const settings = {
    appName: "Bifrost E2E", localLoginEnabled: true, crewProvisioningEmailEnabled: false,
    webOrigins: ["https://tg.legacyh.dev", "https://bifrost.tg.no"], logoUrl: null, faviconUrl: null,
    keycloakBaseUrl: "https://id.example.test", keycloakRealm: "bifrost", keycloakClientId: "bifrost-web", keycloakRedirectUri: null,
    smtpFromEmail: "bifrost@example.test", smtpFromName: "Bifrost", smtpHost: "smtp.example.test", smtpPort: 587, smtpUser: "bifrost", smtpCrypto: "tls",
    osrmBaseUrl: null, crewApiBaseUrl: "https://crew.example.test", crewApiProfileEndpoint: "/profile", crewApiPictureEndpoint: "/picture", crewCacheYear: 2026,
    hasOidcClientSecret: true, hasSmtpPassword: true, hasVegvesenApiKey: false, hasCrewApiBearerToken: true,
  };
  const adminWorkspace = { canManageSettings: true, crewCacheEntries: 0, crewProvisioningRules: [], roles: [], users: [], settings };
  await mockApi(page, async (request, url) => {
    if (url.pathname === "/api/v1/admin" && request.method() === "GET") return { json: adminWorkspace };
    if (url.pathname === "/api/v1/admin/statistics") return { json: emptyAdminStatistics() };
    if (url.pathname === "/api/v1/admin/settings" && request.method() === "PUT") { settingsBody = request.postDataJSON() as Record<string, unknown>; return { status: 204, body: "" }; }
    if (url.pathname === "/api/v1/admin/users/provision-from-crew" && request.method() === "POST") {
      provisionBody = request.postDataJSON() as Record<string, unknown>;
      return { status: 201, json: { created: true, emailQueued: false, profile: { id: 8468, name: "Crew User", nickname: "", crewName: "Arena:Logistikk", role: "Crew", displayName: "Crew User", source: "remote" }, user: { id: 8, name: "Crew User", firstName: "Crew", lastName: "User", email: "crew@example.test", wannabeId: 8468, badgeScanNumber: null, active: true, roleIds: [], roleNames: [], roleDisplayNames: [], competencies: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }, matchedRoles: ["bruker"] } };
    }
    return undefined;
  });
  await page.goto("/admin");

  await page.getByRole("tab", { name: "Systeminnstillinger" }).click();
  const emailToggle = page.getByRole("checkbox", { name: "Send velkomst-e-post til nye Crew-brukere" });
  await expect(emailToggle).toBeVisible();
  await emailToggle.check();
  await page.getByRole("button", { name: "Lagre innstillinger" }).click();
  await expect.poll(() => settingsBody?.crewProvisioningEmailEnabled).toBe(true);

  await page.getByRole("tab", { name: /Brukere/ }).click();
  const provisionCard = page.locator("section").filter({ has: page.getByRole("heading", { name: "Finn person og opprett bruker" }) });
  await provisionCard.getByRole("button", { name: "Wannabe-ID" }).click();
  const wannabe = provisionCard.getByLabel("Wannabe-ID");
  await wannabe.fill("8468");
  await wannabe.press("Enter");
  await expect.poll(() => provisionBody).toEqual({ lookup: "8468", lookupType: "wannabe" });
});

test("redigerer og sletter lokasjon med API-metoder og egen bekreftelse", async ({ page }) => {
  let locations = [{ id: 18, name: "Testlager", type: "Lager", address: null as string | null }];
  let patchBody: unknown;
  let deleteCalled = false;
  await mockApi(page, async (request, url) => {
    if (url.pathname === "/api/v1/locations" && request.method() === "GET") return { json: locations };
    if (url.pathname === "/api/v1/locations/18" && request.method() === "PATCH") {
      patchBody = request.postDataJSON();
      locations = [{ id: 18, ...(patchBody as { name: string; type: string; address?: string }), address: (patchBody as { address?: string }).address ?? null }];
      return { status: 204, body: "" };
    }
    if (url.pathname === "/api/v1/locations/18" && request.method() === "DELETE") {
      deleteCalled = true;
      locations = [];
      return { status: 204, body: "" };
    }
    return undefined;
  });
  await page.goto("/locations");

  const row = page.getByRole("row").filter({ hasText: "Testlager" });
  await row.getByRole("button", { name: "Rediger" }).click();
  const editor = page.getByRole("dialog", { name: "Rediger Testlager" });
  await editor.getByLabel("Navn").fill("Hovedlager");
  await editor.getByLabel("Adresse (valgfritt)").fill("Testveien 1");
  await editor.getByRole("button", { name: "Lagre" }).click();
  await expect(page.getByText("Lokasjonen ble oppdatert.")).toBeVisible();
  expect(patchBody).toEqual({ name: "Hovedlager", type: "Lager", address: "Testveien 1" });

  await page.getByRole("row").filter({ hasText: "Hovedlager" }).getByRole("button", { name: "Rediger" }).click();
  await page.getByRole("dialog", { name: "Rediger Hovedlager" }).getByRole("button", { name: "Slett lokasjon" }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Slett lokasjon?" });
  await expect(confirmation).toBeVisible();
  const box = await confirmation.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs((box!.x + box!.width / 2) - 640)).toBeLessThan(12);
  expect(Math.abs((box!.y + box!.height / 2) - 360)).toBeLessThan(12);
  await confirmation.getByRole("button", { name: "Slett lokasjon" }).click();
  await expect(page.getByText("Lokasjonen ble slettet.")).toBeVisible();
  expect(deleteCalled).toBe(true);
});

test("oppretter utstyr og palle, flytter og inspiserer", async ({ page }) => {
  const location = { id: 4, name: "Hovedlager", type: "Lager", address: "Testveien 1" };
  const equipment: Array<Record<string, unknown>> = [];
  const pallets: Array<Record<string, unknown>> = [];
  await mockApi(page, async (request, url) => {
    if (url.pathname === "/api/v1/equipment-categories" && request.method() === "GET") return { json: [{ id: 1, name: "Samband" }] };
    if (url.pathname === "/api/v1/equipment" && request.method() === "GET") return { json: { items: equipment, pagination: { page: 1, pageSize: 25, total: equipment.length, pageCount: equipment.length ? 1 : 0 } } };
    if (url.pathname === "/api/v1/equipment" && request.method() === "POST") {
      const body = request.postDataJSON() as { name: string; category: string; serialNumber: string; quantity: number };
      equipment.push({ id: 7, ...body, loanedQuantity: 0, status: "available", locationName: null, palletName: null, slotNumber: null, updatedAt: "2026-09-17T10:00:00.000Z" });
      return { status: 201, json: { id: 7, merged: false } };
    }
    if (url.pathname === "/api/v1/locations" && request.method() === "GET") return { json: [location] };
    if (url.pathname === "/api/v1/pallets" && request.method() === "GET") return { json: pallets };
    if (url.pathname === "/api/v1/pallets" && request.method() === "POST") {
      const body = request.postDataJSON() as { locationId: number; name: string; qrCode: string };
      pallets.push({ id: 31, ...body, locationName: location.name });
      return { status: 201, json: pallets[0] };
    }
    if (url.pathname === "/api/v1/equipment/7/move" && request.method() === "POST") {
      equipment[0] = { ...equipment[0], locationName: location.name, palletName: "Palle E2E", slotNumber: 1 };
      return { status: 204, body: "" };
    }
    if (url.pathname === "/api/v1/pallets/31" && request.method() === "GET") {
      return { json: { pallet: pallets[0], rows: [{ slotId: 44, slotNumber: 1, slotStatus: "occupied", equipmentId: 7, equipmentName: "Radio E2E", serialNumber: "E2E-001", quantity: 2, equipmentStatus: "available" }] } };
    }
    return undefined;
  });

  await page.goto("/equipment");
  await page.getByRole("button", { name: "Nytt utstyr" }).click();
  const createEquipment = page.getByRole("dialog", { name: "Registrer utstyr" });
  await createEquipment.getByLabel("Navn").fill("Radio E2E");
  await createEquipment.getByLabel("Kategori").selectOption("Samband");
  await createEquipment.getByLabel("Serienummer").fill("E2E-001");
  await createEquipment.getByLabel("Antall").fill("2");
  await createEquipment.getByRole("button", { name: "Lagre" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Radio E2E" })).toBeVisible();

  await page.goto("/warehouse");
  await page.getByLabel("Pallenummer").fill("Palle E2E");
  await page.getByLabel("Strekkode", { exact: true }).fill("PALLE-E2E");
  await page.getByLabel("Lokasjon").selectOption("4");
  await page.getByRole("button", { name: "Opprett palle" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Palle E2E" })).toBeVisible();

  await page.goto("/equipment");
  await page.getByRole("row").filter({ hasText: "Radio E2E" }).getByRole("button", { name: "Administrer" }).click();
  const manage = page.getByRole("dialog", { name: "Administrer Radio E2E" });
  await manage.getByLabel("Pallens strekkode").fill("PALLE-E2E");
  await manage.getByRole("button", { name: "Flytt utstyr" }).click();
  await expect(page.getByText("Utstyret ble flyttet til pallen.")).toBeVisible();

  await page.goto("/warehouse");
  await page.getByRole("row").filter({ hasText: "Palle E2E" }).getByRole("button", { name: "Inspiser" }).click();
  const inspection = page.getByRole("dialog", { name: "Palle E2E" });
  await expect(inspection.getByRole("row").filter({ hasText: "Radio E2E" })).toContainText("E2E-001");
});

test("bruker Enter for badge-oppslag og låner med strekkode fra navnesøk", async ({ page }) => {
  let issuedBody: unknown;
  await mockApi(page, async (request, url) => {
    if (url.pathname === "/api/v1/loans" && request.method() === "GET") return { json: emptyPage() };
    if (url.pathname === "/api/v1/private-equipment/notices") return { json: [] };
    if (url.pathname === "/api/v1/crew/lookup") return { json: { id: 4242, name: "Test Person", nickname: "Tester", crewName: "Logistikk", role: "Crew", displayName: "Tester · Test Person", source: "cache" } };
    if (url.pathname === "/api/v1/equipment" && url.searchParams.has("search")) {
      return {
        json: {
          items: [{ id: 7, name: "Radio Motorola", category: "Samband", serialNumber: "RADIO-001", quantity: 4, loanedQuantity: 0, status: "available", locationName: "Hovedlager", palletName: null, slotNumber: null, updatedAt: "2026-09-17T10:00:00.000Z" }],
          pagination: { page: 1, pageSize: 8, total: 1, pageCount: 1 },
        },
      };
    }
    if (url.pathname === "/api/v1/loans" && request.method() === "POST") {
      issuedBody = request.postDataJSON();
      return { status: 201, json: { loanIds: [91] } };
    }
    return undefined;
  });
  await page.goto("/loans");

  const badge = page.getByLabel("Wannabe-ID / badge-scan");
  await badge.fill("BADGE-4242");
  await badge.press("Enter");
  await expect(page.getByText("Tester · Test Person")).toBeVisible();

  const equipment = page.getByPlaceholder("Skriv navn eller skann strekkode");
  await equipment.fill("Radio");
  await expect(page.getByRole("button", { name: /Radio Motorola/ })).toBeVisible();
  await equipment.press("Enter");
  await expect(page.getByText("Strekkode: RADIO-001")).toBeVisible();
  await page.getByRole("button", { name: "Registrer lån" }).click();
  await expect(page.getByText("1 lån ble registrert.")).toBeVisible();
  expect(issuedBody).toEqual({ wannabeId: 4242, lines: [{ barcode: "RADIO-001", quantity: 1, privateEquipmentConfirmed: false }] });
});

test("viser nettleservarsler som toast nederst til høyre", async ({ page }) => {
  await mockApi(page);
  await page.goto("/dashboard");
  await page.evaluate(() => window.alert("E2E-varsel"));
  const toast = page.getByRole("status").filter({ hasText: "E2E-varsel" });
  await expect(toast).toBeVisible();
  const box = await toast.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThan(640);
  expect(box!.y).toBeGreaterThan(360);
});

async function mockApi(page: Page, override?: ApiOverride): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const custom = await override?.(request, url);
    if (custom) return fulfill(route, custom);

    if (url.pathname === "/api/v1/auth/config") return fulfill(route, { json: { authority: "https://id.example.test/realms/bifrost", clientId: "bifrost-web", redirectUri: `${url.searchParams.get("origin") ?? "http://127.0.0.1:4173"}/auth/callback`, scope: "openid profile email", localLoginEnabled: true, appName: "Bifrost E2E", logoUrl, faviconUrl } });
    if (url.pathname === "/api/v1/me") return fulfill(route, { json: currentUser });
    if (url.pathname === "/api/v1/feedback/notifications") return fulfill(route, { json: { items: [], unreadCount: 0 } });
    if (url.pathname === "/api/v1/dashboard") return fulfill(route, { json: { activeLoans: 2, activeVehicleLoans: 1, activeTransportJobs: 3, totalTransportDistance: 4420, equipmentPerLocation: [{ locationName: "Hovedlager", equipmentCount: 12 }] } });
    return fulfill(route, { status: 404, json: { error: { code: "E2E_UNMOCKED", message: `${request.method()} ${url.pathname} mangler mock.`, requestId: "e2e" } } });
  });
}

function emptyPage() {
  return { items: [], pagination: { page: 1, pageSize: 25, total: 0, pageCount: 0 } };
}

function emptyAdminStatistics() {
  return {
    users: { total: 0, active: 0, inactive: 0, withWannabeId: 0, withBadgeScan: 0, cached: 0 }, roles: [],
    feedback: { total: 0, pending: 0, approved: 0, onHold: 0, inProgress: 0, implemented: 0, fixed: 0, completedTotal: 0, rejected: 0, needsDatabaseFix: 0, featureTotal: 0, bugTotal: 0 },
    equipment: { totalItems: 0, totalQuantity: 0, availableQuantity: 0, loanedQuantity: 0, maintenanceQuantity: 0, activeLoans: 0, loanedOutQuantity: 0, returnedLoans: 0, returnedQuantity: 0, loanEventsTotal: 0, categories: [] },
    comms: { totalItems: 0, totalQuantity: 0, availableQuantity: 0, loanedQuantity: 0, totalSets: 0, activeLoans: 0, returnedLoans: 0, loanedOutQuantity: 0, returnedQuantity: 0, loanEventsTotal: 0, types: [] },
    vehicles: { total: 0, available: 0, loaned: 0, maintenance: 0, activeLoans: 0, returnedLoans: 0, loanEventsTotal: 0, assignedTransportJobs: 0 },
    requests: { total: 0, pending: 0, partial: 0, fulfilled: 0, returned: 0, rejected: 0, requestedQuantity: 0, requestLines: 0 },
    transport: { total: 0, open: 0, assigned: 0, inProgress: 0, completed: 0, peopleTransport: 0, equipmentTransport: 0 },
    tasks: { total: 0, notStarted: 0, inProgress: 0, blocked: 0, completed: 0, linkedToTransport: 0 },
    shop: { categories: 0, items: 0, totalQuantity: 0, checkoutCount: 0, checkoutQuantity: 0, checkinCount: 0, checkinQuantity: 0, movementsTotal: 0 },
    privateEquipment: { prefixRules: 0 }, locations: { total: 0, withAddress: 0, types: [] }, warehouse: { pallets: 0, slots: 0, occupiedSlots: 0 },
  };
}

function fulfill(route: Parameters<Parameters<Page["route"]>[1]>[0], response: MockResponse) {
  return route.fulfill({
    status: response.status ?? 200,
    contentType: response.json === undefined ? "text/plain" : "application/json",
    body: response.json === undefined ? (response.body ?? "") : JSON.stringify(response.json),
  });
}
