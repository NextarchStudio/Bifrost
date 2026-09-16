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

export interface PrivateEquipmentNotice {
  ownerName: string;
  prefix: string;
  issueMessage: string;
  returnMessage: string;
}

export interface EquipmentLoanReturnResponse {
  loanId: number;
  returnedQuantity: number;
  remainingQuantity: number;
  status: "active" | "returned";
  privateEquipmentNotice: PrivateEquipmentNotice | null;
}

export interface CrewProfile {
  id: number;
  name: string;
  nickname: string;
  crewName: string;
  role: string;
  displayName: string;
  source: "cache" | "remote" | "local";
}

export interface PrivateEquipmentItem {
  id: number;
  name: string;
  serialNumber: string;
  quantity: number;
  status: string;
}

export interface PrivateEquipmentRule extends PrivateEquipmentNotice {
  id: number;
  barcodePrefix: string;
  equipmentCount: number;
  lowestSerial: string | null;
  highestSerial: string | null;
  equipmentItems: PrivateEquipmentItem[];
}

export type EquipmentRequestStatus = "pending" | "approved" | "rejected" | "partial" | "fulfilled" | "returned";

export interface EquipmentRequestSelectionItem {
  id: number;
  name: string;
  serialNumber: string;
  quantity: number;
  status: string;
  locationName: string | null;
}

export interface EquipmentRequestItem {
  id: number;
  equipmentId: number;
  equipmentName: string;
  serialNumber: string;
  quantity: number;
  approvedQuantity: number;
  itemStatus: string;
  equipmentQuantity: number;
  equipmentStatus: string;
  note: string | null;
}

export interface EquipmentRequest {
  id: number;
  requesterUserId: number;
  requesterName: string;
  wannabeId: number;
  title: string;
  notes: string | null;
  status: EquipmentRequestStatus;
  itemsSummary: string;
  changeSummary: string | null;
  createdAt: string;
  updatedAt: string;
  items: EquipmentRequestItem[];
}

export interface EquipmentRequestWorkspaceResponse {
  canCreate: boolean;
  canManage: boolean;
  currentWannabeId: number | null;
  selection: EquipmentRequestSelectionItem[];
  mine: EquipmentRequest[];
  incoming: EquipmentRequest[];
}
