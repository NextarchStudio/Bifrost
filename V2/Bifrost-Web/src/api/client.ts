import type { CurrentUser, EquipmentListResponse } from "@bifrost/contracts";

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

export function getApiUrl(): string {
  return apiUrl;
}

export function createHeaders(accessToken?: string): Headers {
  const headers = new Headers({ Accept: "application/json" });
  if (import.meta.env.VITE_API_TOKEN) headers.set("X-Bifrost-Client", import.meta.env.VITE_API_TOKEN);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return headers;
}
