import { systemSettings, type DatabaseConnection } from "@bifrost/database";
import { eq } from "drizzle-orm";
import type { SecureSettingsStore } from "../settings/secure-settings.js";

const VEGVESEN_API_URL = "https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata";

export interface VehiclePayloadResult {
  success: boolean;
  maxPayloadKg: number | null;
}

export interface VehiclePayloadProvider {
  fetchMaxPayloadKg(registrationNumber: string): Promise<VehiclePayloadResult>;
}

export function createVegvesenVehicleDataService(
  database: DatabaseConnection,
  secureSettings: SecureSettingsStore,
  fetchImplementation: typeof fetch = fetch,
): VehiclePayloadProvider {
  return {
    async fetchMaxPayloadKg(registrationNumber) {
      const normalizedRegistration = registrationNumber.trim().toUpperCase();
      const apiKey = await secureSettings.get("vegvesen.api_key");
      if (!apiKey || !normalizedRegistration) return { success: false, maxPayloadKg: null };

      const [settings] = await database.db.select({ appName: systemSettings.appName })
        .from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
      const url = new URL(VEGVESEN_API_URL);
      url.searchParams.set("kjennemerke", normalizedRegistration);

      try {
        const response = await fetchImplementation(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": `${settings?.appName?.trim() || "Bifrost"}/2.0`,
            "SVV-Authorization": `Apikey ${apiKey}`,
          },
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) return { success: false, maxPayloadKg: null };
        const payload = await response.json() as {
          kjoretoydataListe?: Array<{
            godkjenning?: { tekniskGodkjenning?: { tekniskeData?: { vekter?: { nyttelast?: unknown } } } };
          }>;
        };
        const value = payload.kjoretoydataListe?.[0]?.godkjenning?.tekniskGodkjenning?.tekniskeData?.vekter?.nyttelast;
        const maxPayloadKg = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : null;
        return { success: true, maxPayloadKg: maxPayloadKg !== null && Number.isFinite(maxPayloadKg) ? Math.max(0, Math.trunc(maxPayloadKg)) : null };
      } catch {
        return { success: false, maxPayloadKg: null };
      }
    },
  };
}
