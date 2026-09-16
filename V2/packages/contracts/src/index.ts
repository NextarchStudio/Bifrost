export const BIFROST_ROLES = [
  "developer",
  "chief",
  "co-chief",
  "transport_ansvarlig",
  "skiftleder",
  "sambandsansvarlig",
  "logistikk",
  "shop",
  "innkjop",
  "bruker",
  "ingen_tilbakemeldinger",
] as const;

export type BifrostRole = (typeof BIFROST_ROLES)[number];

export interface HealthResponse {
  service: "bifrost-api";
  status: "ok";
  version: string;
  timestamp: string;
}

export interface ReadyResponse {
  service: "bifrost-api";
  status: "ready" | "not_ready";
  database: "connected" | "unavailable";
  timestamp: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
