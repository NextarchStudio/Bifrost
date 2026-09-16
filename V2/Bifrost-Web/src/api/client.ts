import type { ApiError, CurrentUser, EquipmentCategory, EquipmentListResponse, EquipmentMutationResponse, Location } from "@bifrost/contracts";

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
