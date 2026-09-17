import { systemSettings, type DatabaseConnection } from "@bifrost/database";
import { eq } from "drizzle-orm";

export interface RoutePoint {
  lat: number;
  lon: number;
}

export interface TransportRouting {
  geocode(address: string): Promise<RoutePoint | null>;
  distanceKm(points: RoutePoint[]): Promise<number | null>;
}

export function createTransportRouting(database: DatabaseConnection, fetcher: typeof fetch = fetch): TransportRouting {
  const requestJson = async (url: URL): Promise<unknown> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetcher(url, {
        headers: { Accept: "application/json", "User-Agent": "Bifrost/2.0" },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    async geocode(address) {
      for (const query of geocodeQueries(address)) {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", query);
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("limit", "1");
        url.searchParams.set("countrycodes", "no");
        const payload = await requestJson(url);
        if (!Array.isArray(payload)) continue;
        const result = payload[0] as { lat?: unknown; lon?: unknown } | undefined;
        const lat = Number(result?.lat);
        const lon = Number(result?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat: roundCoordinate(lat), lon: roundCoordinate(lon) };
      }
      return null;
    },

    async distanceKm(points) {
      const coordinates = deduplicateConsecutivePoints(points);
      if (coordinates.length < 2) return null;
      const [settings] = await database.db.select({ osrmBaseUrl: systemSettings.osrmBaseUrl })
        .from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
      const configuredUrl = settings?.osrmBaseUrl?.trim() || "http://localhost:5000";
      let baseUrl: URL;
      try {
        baseUrl = new URL(configuredUrl.endsWith("/") ? configuredUrl : `${configuredUrl}/`);
      } catch {
        return null;
      }
      if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") return null;
      const coordinatePath = coordinates.map((point) => `${point.lon},${point.lat}`).join(";");
      const url = new URL(`route/v1/driving/${coordinatePath}`, baseUrl);
      url.searchParams.set("overview", "false");
      url.searchParams.set("steps", "false");
      const payload = await requestJson(url) as { code?: unknown; routes?: Array<{ distance?: unknown }> } | null;
      const distance = Number(payload?.routes?.[0]?.distance);
      return payload?.code === "Ok" && Number.isFinite(distance) && distance > 0 ? Math.round(distance / 1000) : null;
    },
  };
}

export function geocodeQueries(rawAddress: string): string[] {
  const address = rawAddress.trim();
  if (!address) return [];
  const queries = [address];
  const withCountry = (value: string) => {
    const lower = value.toLocaleLowerCase("nb-NO");
    if (!lower.includes("norway") && !lower.includes("norge")) queries.push(`${value}, Norway`);
  };
  withCountry(address);
  const variants: Array<[string, string]> = [
    ["veien", "vegen"], ["Veien", "Vegen"], ["VEIEN", "VEGEN"],
    ["gata", "gate"], ["Gata", "Gate"], ["GATA", "GATE"],
    [" allé", " alle"], [" Allé", " Alle"],
  ];
  for (const [from, to] of variants) {
    if (!address.includes(from)) continue;
    const variant = address.replaceAll(from, to);
    queries.push(variant);
    withCountry(variant);
  }
  return [...new Set(queries)];
}

function deduplicateConsecutivePoints(points: RoutePoint[]): RoutePoint[] {
  return points.filter((point, index) => index === 0 || point.lat !== points[index - 1]?.lat || point.lon !== points[index - 1]?.lon);
}

function roundCoordinate(value: number): number {
  return Math.round(value * 10_000_000) / 10_000_000;
}
