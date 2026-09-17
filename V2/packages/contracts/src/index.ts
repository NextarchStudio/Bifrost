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

export const VEHICLE_COMPETENCY_CODES = ["t1", "t2", "t3", "t4", "b", "be", "c1", "c1e", "c", "ce"] as const;
export type VehicleCompetencyCode = (typeof VEHICLE_COMPETENCY_CODES)[number];
export type VehicleCompetencyRequirement = "none" | "kdo" | VehicleCompetencyCode;

export interface VehicleCompetencyProfile {
  wannabeId: number;
  competencies: Record<VehicleCompetencyCode, boolean>;
  kdoForVehicle: boolean;
}

export interface VehicleListItem {
  id: number;
  name: string;
  registrationNumber: string;
  competencyRequirement: VehicleCompetencyRequirement;
  competencyOverrideRequirement: VehicleCompetencyCode | null;
  currentOdometer: number | null;
  odometerExempt: boolean;
  vegvesenExempt: boolean;
  maxPayloadKg: number | null;
  vegvesenLastSyncAt: string | null;
  status: string;
  notes: string | null;
  activeLoanId: number | null;
  activeWannabeId: number | null;
  activeBorrowerName: string | null;
  activeIssuedAt: string | null;
}

export interface VehicleWorkspaceResponse {
  canCreate: boolean;
  canEdit: boolean;
  canManageLoans: boolean;
  canManageCompetencies: boolean;
  vehicles: VehicleListItem[];
}

export interface VehicleLoanIssueResponse {
  loanId: number;
}

export interface ProfileUser {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  wannabeId: number;
  roles: string[];
  roleDisplayNames: string[];
}

export interface ProfileEquipmentLoan {
  id: number;
  equipmentName: string;
  serialNumber: string;
  quantity: number;
  status: string;
  issuedAt: string;
}

export interface ProfileVehicleLoan {
  id: number;
  vehicleName: string;
  registrationNumber: string;
  status: string;
  issuedAt: string;
}

export interface ProfileCommsLoan {
  id: number;
  setId: number | null;
  setName: string | null;
  itemsSummary: string;
  totalItems: number;
  issuedAt: string;
}

export interface ProfileEquipmentRequest {
  id: number;
  itemsSummary: string;
  status: EquipmentRequestStatus;
  createdAt: string;
}

export interface UserProfileResponse {
  user: ProfileUser;
  isOwnProfile: boolean;
  canViewOtherProfiles: boolean;
  canViewRequests: boolean;
  pictureAvailable: boolean;
  equipmentLoans: ProfileEquipmentLoan[];
  vehicleLoans: ProfileVehicleLoan[];
  commsLoans: ProfileCommsLoan[];
  requests: ProfileEquipmentRequest[];
}

export const TRANSPORT_JOB_KINDS = ["equipment", "innkjopsrunde", "henterunde", "people"] as const;
export type TransportJobKind = (typeof TRANSPORT_JOB_KINDS)[number];
export type TransportJobStatus = "open" | "assigned" | "in_progress" | "completed";

export interface TransportStop {
  id: number;
  stopNumber: number;
  address: string;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
}

export interface TransportAssignee {
  id: number;
  name: string;
  wannabeId: number | null;
}

export interface TransportVehicleOption {
  id: number;
  name: string;
  registrationNumber: string;
  status: string;
  currentOdometer: number | null;
  odometerExempt: boolean;
}

export interface TransportJob {
  id: number;
  description: string;
  transportType: "equipment" | "people";
  jobKind: TransportJobKind;
  peopleCount: number | null;
  pickupAt: string | null;
  fromLocationId: number;
  fromName: string | null;
  fromType: string;
  fromAddress: string | null;
  toLocationId: number;
  toName: string | null;
  toType: string;
  toAddress: string | null;
  requesterUserId: number | null;
  requesterWannabeId: number | null;
  requesterName: string | null;
  assignedUserId: number | null;
  assignedName: string | null;
  assignedVehicleId: number | null;
  vehicleName: string | null;
  vehicleRegistrationNumber: string | null;
  vehicleOdometerExempt: boolean | null;
  vehicleCurrentOdometer: number | null;
  startOdometer: number | null;
  endOdometer: number | null;
  distanceKm: number | null;
  estimatedDistanceKm: number | null;
  distanceDeviationKm: number | null;
  status: TransportJobStatus;
  createdAt: string;
  updatedAt: string;
  stops: TransportStop[];
  eligibleAssignees: TransportAssignee[];
}

export interface TransportWorkspaceResponse {
  canManage: boolean;
  canRequestPeople: boolean;
  locations: Location[];
  transportLocations: Location[];
  users: TransportAssignee[];
  vehicles: TransportVehicleOption[];
  activeJobs: TransportJob[];
  completedJobs: TransportJob[];
}

export type CommsItemType = "samband" | "tilbehor";

export interface CommsItem {
  id: number;
  name: string;
  type: CommsItemType;
  serialNumber: string | null;
  quantity: number;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommsSetItem {
  id: number;
  itemId: number;
  itemName: string;
  itemType: CommsItemType;
  availableQuantity: number;
  status: string;
  quantity: number;
}

export interface CommsSet {
  id: number;
  name: string;
  notes: string | null;
  itemsSummary: string;
  activeLoanCount: number;
  items: CommsSetItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CommsLoanItem {
  id: number;
  itemId: number;
  itemName: string;
  itemType: CommsItemType;
  serialNumber: string | null;
  quantity: number;
}

export interface CommsLoan {
  id: number;
  wannabeId: number;
  borrowerName: string | null;
  issuedByUserId: number;
  setId: number | null;
  setName: string | null;
  itemsSummary: string;
  totalItems: number;
  issuedAt: string;
  notes: string | null;
  items: CommsLoanItem[];
}

export interface CommsWorkspaceResponse {
  items: CommsItem[];
  sets: CommsSet[];
  activeLoans: CommsLoan[];
}
