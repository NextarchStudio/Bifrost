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

export interface OidcPublicConfig {
  authority: string;
  clientId: string;
  redirectUri: string;
  scope: "openid profile email";
}

export interface CurrentUser {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  wannabeId: number | null;
  roles: string[];
}

export interface EquipmentListItem {
  id: number;
  name: string;
  category: string;
  serialNumber: string;
  quantity: number;
  loanedQuantity: number;
  status: string;
  locationName: string | null;
  palletName: string | null;
  slotNumber: number | null;
  updatedAt: string;
}

export interface EquipmentListResponse {
  items: EquipmentListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

export interface EquipmentMutationResponse {
  id: number;
  merged: boolean;
}

export interface EquipmentCategory {
  id: number;
  name: string;
}

export interface Location {
  id: number;
  name: string;
  type: string;
  address: string | null;
}

export interface Pallet {
  id: number;
  locationId: number;
  name: string;
  qrCode: string | null;
  locationName: string;
}

export interface PalletInspectionRow {
  slotId: number;
  slotNumber: number;
  slotStatus: string;
  equipmentId: number | null;
  equipmentName: string | null;
  serialNumber: string | null;
  quantity: number | null;
  equipmentStatus: string | null;
}

export interface PalletInspection {
  pallet: Pallet;
  rows: PalletInspectionRow[];
}

export interface EquipmentLoanListItem {
  id: number;
  equipmentId: number;
  equipmentName: string;
  serialNumber: string;
  wannabeId: number;
  borrowerName: string | null;
  quantity: number;
  requestId: number | null;
  issuedByUserId: number;
  issuedAt: string;
  status: string;
}

export interface EquipmentLoanListResponse {
  items: EquipmentLoanListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

export interface EquipmentLoanIssueResponse {
  loanIds: number[];
}

export interface EquipmentLoanReturnResponse {
  loanId: number;
  returnedQuantity: number;
  remainingQuantity: number;
  status: "active" | "returned";
}
