import type { ApiError, CrewProfile, CurrentUser, EquipmentCategory, EquipmentListResponse, EquipmentLoanIssueResponse, EquipmentLoanListResponse, EquipmentLoanReturnResponse, EquipmentMutationResponse, EquipmentRequestWorkspaceResponse, Location, Pallet, PalletInspection, PrivateEquipmentNotice, PrivateEquipmentRule } from "@bifrost/contracts";

const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

export async function getCurrentUser(accessToken: string): Promise<CurrentUser> {
  const response = await fetch(`${apiUrl}/api/v1/me`, { headers: createHeaders(accessToken) });
  if (!response.ok) throw new Error(`API svarte med ${response.status}`);
  return response.json() as Promise<CurrentUser>;
}

export async function getEquipment(
  accessToken: string,
  query: { page: number; pageSize?: number; search?: string },
): Promise<EquipmentListResponse> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize ?? 25) });
  if (query.search) params.set("search", query.search);
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
