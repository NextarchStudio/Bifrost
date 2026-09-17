import type { AdminCrewResetPreview, AdminRole, AdminSettings, AdminStatistics, AdminWorkspaceResponse, ApiError, BarcodeExportRequest, CommsItemType, CommsWorkspaceResponse, CrewClothingItemType, CrewClothingMember, CrewClothingWorkspaceResponse, CrewProfile, CurrentUser, DashboardSummary, EquipmentCategory, EquipmentListResponse, EquipmentLoanIssueResponse, EquipmentLoanListResponse, EquipmentLoanReturnResponse, EquipmentMutationResponse, EquipmentRequestWorkspaceResponse, FeedbackNotificationResponse, FeedbackStatus, FeedbackType, FeedbackWorkspaceResponse, GlobalSearchResponse, LocalLoginRequest, LocalLoginResponse, Location, OidcPublicConfig, Pallet, PalletInspection, PrivateEquipmentNotice, PrivateEquipmentRule, ShopImportSummary, ShopWorkspaceResponse, TaskPriority, TaskStatus, TaskType, TaskWorkspaceResponse, TransportJob, TransportJobKind, TransportWorkspaceResponse, UserProfileResponse, VehicleCompetencyCode, VehicleCompetencyProfile, VehicleCompetencyRequirement, VehicleLoanIssueResponse, VehicleWorkspaceResponse } from "@bifrost/contracts";

const configuredApiUrl = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");
const apiUrl = normalizeLocalApiUrl(configuredApiUrl);

function normalizeLocalApiUrl(value: string): string {
  if (typeof window === "undefined") return value;
  try {
    const target = new URL(value);
    const localHosts = new Set(["localhost", "127.0.0.1"]);
    if (localHosts.has(target.hostname) && localHosts.has(window.location.hostname)) {
      target.hostname = window.location.hostname;
      return target.toString().replace(/\/$/, "");
    }
  } catch {
    // The request helpers will surface an actionable error if the configured URL is invalid.
  }
  return value;
}

export async function getAuthConfig(): Promise<OidcPublicConfig> {
  const response = await fetch(`${apiUrl}/api/v1/auth/config`, { headers: createHeaders() });
  if (!response.ok) throw await createApiError(response, "Innloggingskonfigurasjonen er ikke tilgjengelig.");
  return response.json() as Promise<OidcPublicConfig>;
}

export async function loginLocal(input: LocalLoginRequest): Promise<LocalLoginResponse> {
  const headers = createHeaders();
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/auth/local`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Lokal innlogging feilet.");
  return response.json() as Promise<LocalLoginResponse>;
}

export async function logoutLocal(accessToken: string): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/auth/logout`, { method: "POST", headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Lokal utlogging feilet.");
}

export async function getDashboardSummary(accessToken: string): Promise<DashboardSummary> {
  const response = await fetch(`${apiUrl}/api/v1/dashboard`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente dashboardet.");
  return response.json() as Promise<DashboardSummary>;
}

export async function globalSearch(accessToken: string, term: string): Promise<GlobalSearchResponse> {
  const response = await fetch(`${apiUrl}/api/v1/search?q=${encodeURIComponent(term)}`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke søke.");
  return response.json() as Promise<GlobalSearchResponse>;
}

export async function exportBarcodes(
  accessToken: string,
  input: BarcodeExportRequest,
): Promise<{ content: Blob; filename: string; count: number }> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/barcodes/export`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await createApiError(response, "Kunne ikke eksportere strekkodene.");
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "strekkoder.udl";
  const count = Number(response.headers.get("X-Barcode-Count") ?? 0);
  return { content: await response.blob(), filename, count };
}

export async function getCurrentUser(accessToken: string): Promise<CurrentUser> {
  const response = await fetch(`${apiUrl}/api/v1/me`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw new Error(`API svarte med ${response.status}`);
  return response.json() as Promise<CurrentUser>;
}

export async function completeLoginSession(accessToken: string): Promise<CurrentUser> {
  const response = await fetch(`${apiUrl}/api/v1/auth/session`, {
    method: "POST",
    headers: createHeaders(accessToken),
  });
  if (!response.ok) throw await createApiError(response, "Innloggingen kunne ikke fullføres.");
  return response.json() as Promise<CurrentUser>;
}

export async function getEquipment(
  accessToken: string,
  query: { page: number; pageSize?: number; search?: string; category?: string },
): Promise<EquipmentListResponse> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize ?? 25) });
  if (query.search) params.set("search", query.search);
  if (query.category) params.set("category", query.category);
  const response = await fetch(`${apiUrl}/api/v1/equipment?${params}`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw new Error(`Kunne ikke hente utstyr (${response.status}).`);
  return response.json() as Promise<EquipmentListResponse>;
}

export async function createEquipment(
  accessToken: string,
  input: { name: string; category: string; serialNumber: string; quantity: number; notes?: string },
): Promise<EquipmentMutationResponse> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/equipment`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette utstyr.");
  return response.json() as Promise<EquipmentMutationResponse>;
}

export async function updateEquipmentDetails(
  accessToken: string,
  equipmentId: number,
  input: { name: string; serialNumber: string; quantity: number },
): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/equipment/${equipmentId}`, "PATCH", input, "Kunne ikke oppdatere utstyret.");
}

export async function updateEquipmentStatus(accessToken: string, equipmentId: number, status: string): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/equipment/${equipmentId}/status`, "PATCH", { status }, "Kunne ikke oppdatere status.");
}

export async function moveEquipment(accessToken: string, equipmentId: number, palletQrCode: string): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/equipment/${equipmentId}/move`, "POST", { palletQrCode }, "Kunne ikke flytte utstyret.");
}

export async function deleteEquipment(accessToken: string, equipmentId: number): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/equipment/${equipmentId}`, {
    method: "DELETE",
    headers: createHeaders(accessToken),
  });
  if (!response.ok) throw await createApiError(response, "Kunne ikke slette utstyret.");
}

export async function getEquipmentCategories(accessToken: string): Promise<EquipmentCategory[]> {
  const response = await fetch(`${apiUrl}/api/v1/equipment-categories`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw new Error(`Kunne ikke hente kategorier (${response.status}).`);
  return response.json() as Promise<EquipmentCategory[]>;
}

export async function createEquipmentCategory(accessToken: string, name: string): Promise<EquipmentCategory> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/equipment-categories`, { method: "POST", headers, body: JSON.stringify({ name }) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette kategorien.");
  return response.json() as Promise<EquipmentCategory>;
}

export async function deleteEquipmentCategory(accessToken: string, categoryId: number): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/equipment-categories/${categoryId}`, { method: "DELETE", headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke slette kategorien.");
}

export async function getLocations(accessToken: string): Promise<Location[]> {
  const response = await fetch(`${apiUrl}/api/v1/locations`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente lokasjoner.");
  return response.json() as Promise<Location[]>;
}

export async function createLocation(
  accessToken: string,
  input: { name: string; type: string; address?: string },
): Promise<Location> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/locations`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette lokasjonen.");
  return response.json() as Promise<Location>;
}

export async function updateLocation(
  accessToken: string,
  locationId: number,
  input: { name: string; type: string; address?: string },
): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/locations/${locationId}`, "PATCH", input, "Kunne ikke oppdatere lokasjonen.");
}

export async function deleteLocation(accessToken: string, locationId: number): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/locations/${locationId}`, {
    method: "DELETE",
    headers: createHeaders(accessToken),
  });
  if (!response.ok) throw await createApiError(response, "Kunne ikke slette lokasjonen.");
}

export async function getPallets(accessToken: string): Promise<Pallet[]> {
  const response = await fetch(`${apiUrl}/api/v1/pallets`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente paller.");
  return response.json() as Promise<Pallet[]>;
}

export async function getPalletInspection(accessToken: string, palletId: number): Promise<PalletInspection> {
  const response = await fetch(`${apiUrl}/api/v1/pallets/${palletId}`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke inspisere pallen.");
  return response.json() as Promise<PalletInspection>;
}

export async function createPallet(accessToken: string, input: { locationId: number; name: string; qrCode: string }): Promise<Pallet> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/pallets`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette pallen.");
  return response.json() as Promise<Pallet>;
}

export async function movePalletToLocation(accessToken: string, palletId: number, locationId: number): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/pallets/${palletId}/location`, "PATCH", { locationId }, "Kunne ikke flytte pallen.");
}

export async function addEquipmentToPallet(accessToken: string, input: { palletQrCode: string; equipmentBarcode: string }): Promise<void> {
  await sendApiMutation(accessToken, "/api/v1/pallets/equipment", "POST", input, "Kunne ikke legge utstyret på pallen.");
}

export async function createPalletSlot(accessToken: string, palletId: number, input: { slotNumber: number; status: string }): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/pallets/${palletId}/slots`, "POST", input, "Kunne ikke opprette palleplassen.");
}

export async function deletePallet(accessToken: string, palletId: number): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/pallets/${palletId}`, { method: "DELETE", headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke slette pallen.");
}

export async function getEquipmentLoans(
  accessToken: string,
  query: { page: number; pageSize?: number; search?: string },
): Promise<EquipmentLoanListResponse> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize ?? 25) });
  if (query.search) params.set("search", query.search);
  const response = await fetch(`${apiUrl}/api/v1/loans?${params}`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente aktive lån.");
  return response.json() as Promise<EquipmentLoanListResponse>;
}

export async function lookupCrewProfile(accessToken: string, query: string): Promise<CrewProfile> {
  const params = new URLSearchParams({ query });
  const response = await fetch(`${apiUrl}/api/v1/crew/lookup?${params}`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke slå opp personen.");
  return response.json() as Promise<CrewProfile>;
}

export async function issueEquipmentLoans(
  accessToken: string,
  input: { wannabeId: number; lines: Array<{ barcode: string; quantity: number; privateEquipmentConfirmed?: boolean }> },
): Promise<EquipmentLoanIssueResponse> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/loans`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke registrere lånet.");
  return response.json() as Promise<EquipmentLoanIssueResponse>;
}

export async function returnEquipmentLoan(accessToken: string, loanId: number, quantity: number): Promise<EquipmentLoanReturnResponse> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/loans/${loanId}/return`, { method: "POST", headers, body: JSON.stringify({ quantity }) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke returnere utstyret.");
  return response.json() as Promise<EquipmentLoanReturnResponse>;
}

export async function getPrivateEquipment(accessToken: string): Promise<PrivateEquipmentRule[]> {
  const response = await fetch(`${apiUrl}/api/v1/private-equipment`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente regler for privat utstyr.");
  return response.json() as Promise<PrivateEquipmentRule[]>;
}

export async function getPrivateEquipmentNotices(accessToken: string): Promise<PrivateEquipmentNotice[]> {
  const response = await fetch(`${apiUrl}/api/v1/private-equipment/notices`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente varsler for privat utstyr.");
  return response.json() as Promise<PrivateEquipmentNotice[]>;
}

export async function createPrivateEquipmentRule(
  accessToken: string,
  input: { ownerName: string; barcodePrefix: string },
): Promise<PrivateEquipmentRule> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/private-equipment`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette privat utstyr-regelen.");
  return response.json() as Promise<PrivateEquipmentRule>;
}

export async function deletePrivateEquipmentRule(accessToken: string, id: number): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/private-equipment/${id}`, { method: "DELETE", headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke slette privat utstyr-regelen.");
}

export async function getEquipmentRequestWorkspace(accessToken: string): Promise<EquipmentRequestWorkspaceResponse> {
  const response = await fetch(`${apiUrl}/api/v1/equipment-requests`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente utstyrsforespørsler.");
  return response.json() as Promise<EquipmentRequestWorkspaceResponse>;
}

export async function createEquipmentRequest(
  accessToken: string,
  items: Array<{ equipmentId: number; quantity: number; note?: string }>,
): Promise<{ id: number }> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/equipment-requests`, { method: "POST", headers, body: JSON.stringify({ items }) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke sende utstyrsforespørselen.");
  return response.json() as Promise<{ id: number }>;
}

export async function deleteEquipmentRequest(accessToken: string, id: number): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/equipment-requests/${id}`, { method: "DELETE", headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke slette utstyrsforespørselen.");
}

export async function updateEquipmentRequestStatus(
  accessToken: string,
  id: number,
  status: "pending" | "rejected" | "fulfilled",
): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/equipment-requests/${id}/status`, "PATCH", { status }, "Kunne ikke oppdatere forespørselen.");
}

export async function approveEquipmentRequest(
  accessToken: string,
  id: number,
  input: {
    approveAll: boolean;
    decisions: Array<{ itemId: number; approvedQuantity: number; rejected: boolean; privateEquipmentConfirmed?: boolean }>;
  },
): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/equipment-requests/${id}/approve`, "POST", input, "Kunne ikke behandle forespørselen.");
}

export async function getVehicleWorkspace(accessToken: string): Promise<VehicleWorkspaceResponse> {
  const response = await fetch(`${apiUrl}/api/v1/vehicles`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente kjøretøy.");
  return response.json() as Promise<VehicleWorkspaceResponse>;
}

export async function createVehicle(
  accessToken: string,
  input: {
    name: string;
    registrationNumber: string;
    competencyRequirement: VehicleCompetencyRequirement;
    competencyOverrideRequirement?: VehicleCompetencyCode | null;
    odometerMode: "tracked" | "exempt";
    currentOdometer?: number | null;
    vegvesenExempt: boolean;
    notes?: string | null;
  },
): Promise<{ id: number }> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/vehicles`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette kjøretøyet.");
  return response.json() as Promise<{ id: number }>;
}

export async function updateVehicle(
  accessToken: string,
  id: number,
  input: {
    name: string;
    registrationNumber: string;
    competencyRequirement: VehicleCompetencyRequirement;
    competencyOverrideRequirement?: VehicleCompetencyCode | null;
    vegvesenExempt: boolean;
  },
): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/vehicles/${id}`, "PATCH", input, "Kunne ikke oppdatere kjøretøyet.");
}

export async function deleteVehicle(accessToken: string, id: number): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/vehicles/${id}`, { method: "DELETE", headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke slette kjøretøyet.");
}

export async function getVehicleCompetencyProfile(
  accessToken: string,
  wannabeId: number,
  vehicleId?: number,
): Promise<VehicleCompetencyProfile> {
  const params = new URLSearchParams();
  if (vehicleId) params.set("vehicleId", String(vehicleId));
  const query = params.size ? `?${params}` : "";
  const response = await fetch(`${apiUrl}/api/v1/vehicles/competencies/${wannabeId}${query}`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente kompetanseprofilen.");
  return response.json() as Promise<VehicleCompetencyProfile>;
}

export async function saveVehicleCompetencyProfile(
  accessToken: string,
  wannabeId: number,
  competencies: VehicleCompetencyCode[],
): Promise<void> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/vehicles/competencies/${wannabeId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ competencies }),
  });
  if (!response.ok) throw await createApiError(response, "Kunne ikke lagre kompetanseprofilen.");
}

export async function issueVehicleLoan(
  accessToken: string,
  input: {
    vehicleId: number;
    wannabeId: number;
    competencyConfirmed: boolean;
    competencies: Array<VehicleCompetencyCode | "kdo">;
  },
): Promise<VehicleLoanIssueResponse> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/vehicle-loans`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke registrere kjøretøylånet.");
  return response.json() as Promise<VehicleLoanIssueResponse>;
}

export async function returnVehicleLoan(accessToken: string, loanId: number): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/vehicle-loans/${loanId}/return`, "POST", {}, "Kunne ikke returnere kjøretøyet.");
}

export async function getTransportWorkspace(accessToken: string): Promise<TransportWorkspaceResponse> {
  const response = await fetch(`${apiUrl}/api/v1/transport`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente transportoppdrag.");
  return response.json() as Promise<TransportWorkspaceResponse>;
}

export async function getTransportJob(accessToken: string, id: number): Promise<TransportJob> {
  const response = await fetch(`${apiUrl}/api/v1/transport/${id}`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke inspisere transportoppdraget.");
  return response.json() as Promise<TransportJob>;
}

export async function createTransportJob(
  accessToken: string,
  input: {
    description: string;
    fromLocationId: number;
    toLocationId: number;
    vehicleId: number;
    jobKind: Exclude<TransportJobKind, "people">;
    requesterUserId?: number | null;
    requesterWannabeId?: number | null;
    stops: Array<{ address: string; notes?: string | null }>;
  },
): Promise<{ id: number }> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/transport`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette transportoppdraget.");
  return response.json() as Promise<{ id: number }>;
}

export async function requestPeopleTransport(
  accessToken: string,
  input: { description?: string | null; fromLocationId: number; toLocationId: number; peopleCount: number; pickupAt: string },
): Promise<{ id: number }> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/transport/people-requests`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke sende transportforespørselen.");
  return response.json() as Promise<{ id: number }>;
}

export async function assignTransportJob(accessToken: string, id: number, assignedUserId: number): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/transport/${id}/assign`, "POST", { assignedUserId }, "Kunne ikke tildele transportoppdraget.");
}

export async function startTransportJob(accessToken: string, id: number, input: { vehicleId?: number | null; startOdometer?: number | null }): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/transport/${id}/start`, "POST", input, "Kunne ikke starte transportoppdraget.");
}

export async function completeTransportJob(accessToken: string, id: number, endOdometer: number | null): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/transport/${id}/complete`, "POST", { endOdometer }, "Kunne ikke fullføre transportoppdraget.");
}

export async function getCommsWorkspace(accessToken: string): Promise<CommsWorkspaceResponse> {
  const response = await fetch(`${apiUrl}/api/v1/comms`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente sambandsdata.");
  return response.json() as Promise<CommsWorkspaceResponse>;
}

export async function createCommsItem(accessToken: string, input: { name: string; type: CommsItemType; serialNumber?: string | null; quantity: number; notes?: string | null }): Promise<{ id: number }> {
  const headers = createHeaders(accessToken); headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/comms/items`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette samband/tilbehør.");
  return response.json() as Promise<{ id: number }>;
}

export async function updateCommsItem(accessToken: string, id: number, input: { name: string; type: CommsItemType; serialNumber?: string | null; quantity: number; notes?: string | null }): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/comms/items/${id}`, "PATCH", input, "Kunne ikke oppdatere samband/tilbehør.");
}

export async function createCommsSet(accessToken: string, input: { name: string; notes?: string | null; items: Array<{ itemId: number; quantity: number }> }): Promise<{ id: number }> {
  const headers = createHeaders(accessToken); headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/comms/sets`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette sambandssettet.");
  return response.json() as Promise<{ id: number }>;
}

export async function updateCommsSet(accessToken: string, id: number, input: { name: string; notes?: string | null; items: Array<{ itemId: number; quantity: number }> }): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/comms/sets/${id}`, "PATCH", input, "Kunne ikke oppdatere sambandssettet.");
}

export async function deleteCommsSet(accessToken: string, id: number): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/comms/sets/${id}`, { method: "DELETE", headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke slette sambandssettet.");
}

export async function issueCommsLoan(accessToken: string, input: { wannabeId: number; loanType: "item"; itemId: number; quantity: number; notes?: string | null } | { wannabeId: number; loanType: "set"; setId: number; notes?: string | null }): Promise<{ loanId: number }> {
  const headers = createHeaders(accessToken); headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/comms/loans`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke registrere sambandslånet.");
  return response.json() as Promise<{ loanId: number }>;
}

export async function returnCommsLoan(accessToken: string, id: number, input: { returns: Array<{ itemId: number; quantity: number }>; replacementItemId?: number | null; replacementQuantity?: number | null }): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/comms/loans/${id}/return`, "POST", input, "Kunne ikke lagre retur eller bytte.");
}

export async function getShopWorkspace(accessToken: string): Promise<ShopWorkspaceResponse> {
  const response = await fetch(`${apiUrl}/api/v1/shop`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente butikkdata.");
  return response.json() as Promise<ShopWorkspaceResponse>;
}

export async function createShopCategory(accessToken: string, name: string): Promise<{ id: number }> {
  const headers = createHeaders(accessToken); headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/shop/categories`, { method: "POST", headers, body: JSON.stringify({ name }) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette kategorien.");
  return response.json() as Promise<{ id: number }>;
}

export async function createShopItem(accessToken: string, input: { name: string; categoryId?: number | null; newCategory?: string | null; size?: string | null; quantity: number; notes?: string | null }): Promise<{ id: number }> {
  const headers = createHeaders(accessToken); headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/shop/items`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette varen.");
  return response.json() as Promise<{ id: number }>;
}

export async function moveShopItem(accessToken: string, id: number, type: "check-in" | "check-out", quantity: number): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/shop/items/${id}/${type}`, "POST", { quantity }, "Kunne ikke oppdatere lagerbeholdningen.");
}

export async function deleteShopItem(accessToken: string, id: number): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/shop/items/${id}`, { method: "DELETE", headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke slette varen.");
}

export async function importShopInventory(accessToken: string, file: File): Promise<ShopImportSummary> {
  const form = new FormData(); form.set("inventory_file", file);
  const response = await fetch(`${apiUrl}/api/v1/shop/import`, { method: "POST", headers: createHeaders(accessToken), body: form });
  if (!response.ok) throw await createApiError(response, "Kunne ikke importere varetellingen.");
  return response.json() as Promise<ShopImportSummary>;
}

export async function downloadShopExport(accessToken: string, format: "csv" | "pdf"): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${apiUrl}/api/v1/shop/export.${format}`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke eksportere varelageret.");
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `varelager.${format}`;
  return { blob: await response.blob(), filename };
}

export async function getCrewClothingWorkspace(accessToken: string): Promise<CrewClothingWorkspaceResponse> {
  const response = await fetch(`${apiUrl}/api/v1/crew-clothing`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente crewtøydata.");
  return response.json() as Promise<CrewClothingWorkspaceResponse>;
}

export async function lookupCrewClothingMember(accessToken: string, query: string): Promise<CrewClothingMember> {
  const headers = createHeaders(accessToken); headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/crew-clothing/lookup`, { method: "POST", headers, body: JSON.stringify({ query }) });
  if (!response.ok) throw await createApiError(response, "Fant ikke crewmedlemmet.");
  return response.json() as Promise<CrewClothingMember>;
}

export async function saveCrewClothingInventory(accessToken: string, input: { itemType: CrewClothingItemType; size: string; quantity: number }): Promise<{ id: number }> {
  const headers = createHeaders(accessToken); headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/crew-clothing/inventory`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke lagre varelinjen.");
  return response.json() as Promise<{ id: number }>;
}

export async function updateCrewClothingInventory(accessToken: string, id: number, input: { itemType: CrewClothingItemType; size: string; quantity: number }): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/crew-clothing/inventory/${id}`, "PATCH", input, "Kunne ikke oppdatere varelinjen.");
}

export async function deleteCrewClothingInventory(accessToken: string, id: number): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/crew-clothing/inventory/${id}`, { method: "DELETE", headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke slette varelinjen.");
}

export async function updateCrewClothingMember(accessToken: string, id: number, input: { crewId?: number | null; tshirtSize?: string | null; hoodieSize?: string | null }): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/crew-clothing/members/${id}`, "PATCH", input, "Kunne ikke oppdatere crewmedlemmet.");
}

export async function setCrewClothingDelivery(accessToken: string, id: number, itemTypes: CrewClothingItemType[], delivered: boolean): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/crew-clothing/members/${id}/delivery`, "POST", { itemTypes, delivered }, "Kunne ikke oppdatere utleveringsstatusen.");
}

export async function createCrewClothingCrew(accessToken: string, input: { name: string; tshirtMax: number; hoodieMax: number }): Promise<{ id: number }> {
  const headers = createHeaders(accessToken); headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/crew-clothing/crews`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette crewet.");
  return response.json() as Promise<{ id: number }>;
}

export async function updateCrewClothingCrew(accessToken: string, id: number, input: { name: string; tshirtMax: number; hoodieMax: number }): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/crew-clothing/crews/${id}`, "PATCH", input, "Kunne ikke oppdatere crewet.");
}

export async function getTaskWorkspace(accessToken: string): Promise<TaskWorkspaceResponse> {
  const response = await fetch(`${apiUrl}/api/v1/tasks`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente oppgavene.");
  return response.json() as Promise<TaskWorkspaceResponse>;
}

export async function createTask(accessToken: string, input: { title: string; type: TaskType; transportJobId?: number | null; status: TaskStatus; priority: TaskPriority; message?: string | null; description: string; assignedUserId: number; dueAt: string }): Promise<{ id: number }> {
  const headers = createHeaders(accessToken); headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/tasks`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette oppgaven.");
  return response.json() as Promise<{ id: number }>;
}

export async function updateTaskStatus(accessToken: string, id: number, status: TaskStatus): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/tasks/${id}/status`, "PATCH", { status }, "Kunne ikke oppdatere oppgavestatusen.");
}

export async function deleteTask(accessToken: string, id: number): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/tasks/${id}`, { method: "DELETE", headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke slette oppgaven.");
}

export async function getFeedbackWorkspace(accessToken: string): Promise<FeedbackWorkspaceResponse> {
  const response = await fetch(`${apiUrl}/api/v1/feedback`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente tilbakemeldingene.");
  return response.json() as Promise<FeedbackWorkspaceResponse>;
}

export async function createFeedback(accessToken: string, input: { type: FeedbackType; title: string; description: string; needsDatabaseFix: boolean; attachment?: File | null }): Promise<{ id: number }> {
  const form = new FormData();
  form.set("type", input.type); form.set("title", input.title); form.set("description", input.description);
  if (input.needsDatabaseFix) form.set("needsDatabaseFix", "1");
  if (input.attachment) form.set("attachment", input.attachment);
  const response = await fetch(`${apiUrl}/api/v1/feedback`, { method: "POST", headers: createHeaders(accessToken), body: form });
  if (!response.ok) throw await createApiError(response, "Kunne ikke sende tilbakemeldingen.");
  return response.json() as Promise<{ id: number }>;
}

export async function updateFeedbackStatus(accessToken: string, id: number, status: FeedbackStatus): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/feedback/${id}/status`, "PATCH", { status }, "Kunne ikke oppdatere tilbakemeldingsstatusen.");
}

export async function deleteFeedback(accessToken: string, id: number): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/feedback/${id}`, { method: "DELETE", headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke slette tilbakemeldingen.");
}

export async function getFeedbackAttachment(accessToken: string, id: number): Promise<Blob> {
  const response = await fetch(`${apiUrl}/api/v1/feedback/${id}/attachment`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente vedlegget.");
  return response.blob();
}

export async function getFeedbackNotifications(accessToken: string): Promise<FeedbackNotificationResponse> {
  const response = await fetch(`${apiUrl}/api/v1/feedback/notifications`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente varsler.");
  return response.json() as Promise<FeedbackNotificationResponse>;
}

export async function markFeedbackNotificationsRead(accessToken: string): Promise<void> {
  await sendApiMutation(accessToken, "/api/v1/feedback/notifications/read", "POST", {}, "Kunne ikke markere varsler som lest.");
}

export async function getAdminWorkspace(accessToken: string): Promise<AdminWorkspaceResponse> {
  const response = await fetch(`${apiUrl}/api/v1/admin`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente administrasjonen.");
  return response.json() as Promise<AdminWorkspaceResponse>;
}

export async function getAdminStatistics(accessToken: string): Promise<AdminStatistics> {
  const response = await fetch(`${apiUrl}/api/v1/admin/statistics`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente statistikk.");
  return response.json() as Promise<AdminStatistics>;
}

export async function createAdminUser(accessToken: string, input: { firstName: string; lastName: string; email: string; wannabeId?: number | null }): Promise<{ id: number }> {
  const headers = createHeaders(accessToken); headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/admin/users`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette brukeren.");
  return response.json() as Promise<{ id: number }>;
}

export async function setAdminUserActive(accessToken: string, id: number, active: boolean): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/admin/users/${id}/active`, "PATCH", { active }, "Kunne ikke oppdatere brukerstatusen.");
}

export async function syncAdminUserRoles(accessToken: string, id: number, roleIds: number[]): Promise<void> {
  await sendApiPut(accessToken, `/api/v1/admin/users/${id}/roles`, { roleIds }, "Kunne ikke oppdatere brukerrollene.");
}

export async function updateAdminUserCompetencies(accessToken: string, id: number, competencies: VehicleCompetencyCode[]): Promise<void> {
  await sendApiPut(accessToken, `/api/v1/admin/users/${id}/competencies`, { competencies }, "Kunne ikke oppdatere kompetansene.");
}

export async function deleteAdminUser(accessToken: string, id: number): Promise<void> {
  await sendApiDelete(accessToken, `/api/v1/admin/users/${id}`, "Kunne ikke slette brukeren.");
}

export async function createAdminRole(accessToken: string, input: Omit<AdminRole, "id" | "protected" | "userCount">): Promise<{ id: number }> {
  const headers = createHeaders(accessToken); headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/admin/roles`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke opprette rollen.");
  return response.json() as Promise<{ id: number }>;
}

export async function updateAdminRole(accessToken: string, id: number, input: Omit<AdminRole, "id" | "protected" | "userCount">): Promise<void> {
  await sendApiMutation(accessToken, `/api/v1/admin/roles/${id}`, "PATCH", input, "Kunne ikke oppdatere rollen.");
}

export async function deleteAdminRole(accessToken: string, id: number): Promise<void> {
  await sendApiDelete(accessToken, `/api/v1/admin/roles/${id}`, "Kunne ikke slette rollen.");
}

export async function updateAdminSettings(accessToken: string, input: AdminSettings & { keycloakClientSecret?: string | null; smtpPassword?: string | null; vegvesenApiKey?: string | null; crewApiBearerToken?: string | null }): Promise<void> {
  await sendApiPut(accessToken, "/api/v1/admin/settings", input, "Kunne ikke oppdatere systeminnstillingene.");
}

export async function getAdminCrewResetPreview(accessToken: string): Promise<AdminCrewResetPreview> {
  const response = await fetch(`${apiUrl}/api/v1/admin/crew-cache/preview`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke forhåndsvise crew-reset.");
  return response.json() as Promise<AdminCrewResetPreview>;
}

export async function clearAdminCrewCache(accessToken: string, confirmation: string): Promise<AdminCrewResetPreview> {
  const headers = createHeaders(accessToken); headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/admin/crew-cache/clear`, { method: "POST", headers, body: JSON.stringify({ confirmation }) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke fullføre crew-reset.");
  return response.json() as Promise<AdminCrewResetPreview>;
}

export async function getUserProfile(accessToken: string, wannabeId: number): Promise<UserProfileResponse> {
  const response = await fetch(`${apiUrl}/api/v1/profiles/${wannabeId}`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente profilen.");
  return response.json() as Promise<UserProfileResponse>;
}

export async function getUserProfilePicture(accessToken: string, wannabeId: number): Promise<Blob | null> {
  const response = await fetch(`${apiUrl}/api/v1/profiles/${wannabeId}/picture`, { headers: createHeaders(accessToken) });
  if (response.status === 404) return null;
  if (!response.ok) throw await createApiError(response, "Kunne ikke hente profilbildet.");
  return response.blob();
}

async function sendApiMutation(
  accessToken: string,
  path: string,
  method: "PATCH" | "POST",
  body: unknown,
  fallbackMessage: string,
): Promise<void> {
  const headers = createHeaders(accessToken);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}${path}`, { method, headers, body: JSON.stringify(body) });
  if (!response.ok) throw await createApiError(response, fallbackMessage);
}

async function sendApiPut(accessToken: string, path: string, body: unknown, fallbackMessage: string): Promise<void> {
  const headers = createHeaders(accessToken); headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiUrl}${path}`, { method: "PUT", headers, body: JSON.stringify(body) });
  if (!response.ok) throw await createApiError(response, fallbackMessage);
}

async function sendApiDelete(accessToken: string, path: string, fallbackMessage: string): Promise<void> {
  const response = await fetch(`${apiUrl}${path}`, { method: "DELETE", headers: createHeaders(accessToken) });
  if (!response.ok) throw await createApiError(response, fallbackMessage);
}

async function createApiError(response: Response, fallbackMessage: string): Promise<Error> {
  try {
    const body = await response.json() as Partial<ApiError>;
    const message = body.error?.message?.trim();
    if (message) return new Error(message);
  } catch {
    // The fallback below is used when the response is not a JSON API error.
  }
  return new Error(`${fallbackMessage} (${response.status})`);
}

export function getApiUrl(): string {
  return apiUrl;
}

export function createHeaders(accessToken?: string): Headers {
  const headers = new Headers({ Accept: "application/json" });
  if (import.meta.env.VITE_API_TOKEN) headers.set("X-Bifrost-Client", import.meta.env.VITE_API_TOKEN);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return headers;
}
