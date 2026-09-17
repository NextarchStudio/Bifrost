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

export const SHOP_SIZE_OPTIONS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "XXXXXL", "XXXXXXL"] as const;
export type ShopSize = (typeof SHOP_SIZE_OPTIONS)[number];

export interface ShopCategory {
  id: number;
  name: string;
}

export interface ShopItem {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  size: string | null;
  quantity: number;
  status: string;
  discontinuedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShopMovement {
  id: number;
  shopItemId: number;
  itemName: string;
  itemSize: string | null;
  categoryName: string;
  actorUserId: number;
  actorName: string | null;
  movementType: "checkin" | "checkout";
  quantity: number;
  notes: string | null;
  createdAt: string;
}

export interface ShopWorkspaceResponse {
  categories: ShopCategory[];
  items: ShopItem[];
  movements: ShopMovement[];
  sizeOptions: readonly ShopSize[];
}

export interface ShopImportSummary {
  created: number;
  checkedIn: number;
  checkedOut: number;
  unchanged: number;
}

export type CrewClothingItemType = "tshirt" | "hoodie";

export interface CrewClothingCrew {
  id: number;
  name: string;
  tshirtMax: number;
  hoodieMax: number;
  membersTotal: number;
  tshirtDeliveredTotal: number;
  hoodieDeliveredTotal: number;
}

export interface CrewClothingMember {
  id: number;
  crewId: number | null;
  crewName: string | null;
  wannabeId: number | null;
  badgeScanNumber: string | null;
  name: string;
  nickname: string | null;
  tshirtSize: string | null;
  tshirtDelivered: boolean;
  tshirtDeliveredAt: string | null;
  tshirtDeliveredByUserId: number | null;
  hoodieSize: string | null;
  hoodieDelivered: boolean;
  hoodieDeliveredAt: string | null;
  hoodieDeliveredByUserId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrewClothingInventoryItem {
  id: number;
  itemType: CrewClothingItemType;
  size: ShopSize;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrewClothingWorkspaceResponse {
  canManageCrews: boolean;
  crews: CrewClothingCrew[];
  members: CrewClothingMember[];
  inventory: CrewClothingInventoryItem[];
  sizeOptions: readonly ShopSize[];
}

export type TaskType = "work" | "transport";
export type TaskStatus = "not_started" | "in_progress" | "blocked" | "completed";
export type TaskPriority = 1 | 2 | 3;

export interface BifrostTask {
  id: number;
  title: string;
  type: TaskType;
  transportJobId: number | null;
  transportDescription: string | null;
  transportStatus: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  message: string | null;
  description: string;
  assignedUserId: number;
  assignedName: string;
  assignedWannabeId: number | null;
  createdByUserId: number;
  createdByName: string;
  dueAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskUserOption {
  id: number;
  name: string;
  wannabeId: number | null;
}

export interface TaskTransportOption {
  id: number;
  description: string;
  status: string;
}

export interface TaskWorkspaceResponse {
  canManageAll: boolean;
  currentUserId: number;
  myTasks: BifrostTask[];
  allTasks: BifrostTask[];
  users: TaskUserOption[];
  transportJobs: TaskTransportOption[];
}

export type FeedbackType = "bug" | "feature";
export type FeedbackStatus = "pending" | "on_hold" | "approved" | "in_progress" | "fixed" | "added" | "rejected";

export interface FeedbackEntry {
  id: number;
  requesterUserId: number;
  wannabeId: number | null;
  requesterName: string;
  type: FeedbackType;
  title: string;
  description: string;
  needsDatabaseFix: boolean;
  hasAttachment: boolean;
  attachmentOriginalName: string | null;
  status: FeedbackStatus;
  resolvedAt: string | null;
  addedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackWorkspaceResponse {
  canViewAll: boolean;
  canManageAll: boolean;
  myEntries: FeedbackEntry[];
  allEntries: FeedbackEntry[];
}

export interface FeedbackNotification {
  id: number;
  status: "fixed" | "added";
  statusLabel: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export interface FeedbackNotificationResponse {
  items: FeedbackNotification[];
  unreadCount: number;
}

export interface AdminRole {
  id: number;
  name: string;
  displayName: string | null;
  wannabeRoleName: string | null;
  protected: boolean;
  userCount: number;
}

export interface AdminUser {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  wannabeId: number | null;
  badgeScanNumber: string | null;
  active: boolean;
  roleIds: number[];
  roleNames: string[];
  roleDisplayNames: string[];
  competencies: VehicleCompetencyCode[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminSettings {
  appName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  keycloakBaseUrl: string | null;
  keycloakRealm: string | null;
  keycloakClientId: string | null;
  keycloakRedirectUri: string | null;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpCrypto: "tls" | "ssl" | null;
  osrmBaseUrl: string | null;
  crewApiBaseUrl: string | null;
  crewApiProfileEndpoint: string | null;
  crewApiPictureEndpoint: string | null;
  crewCacheYear: number | null;
  hasOidcClientSecret: boolean;
  hasSmtpPassword: boolean;
  hasVegvesenApiKey: boolean;
  hasCrewApiBearerToken: boolean;
}

export interface AdminWorkspaceResponse {
  canManageSettings: boolean;
  crewCacheEntries: number;
  roles: AdminRole[];
  users: AdminUser[];
  settings: AdminSettings | null;
}

export interface AdminCountBreakdown {
  name: string;
  total: number;
}

export interface AdminInventoryBreakdown {
  name: string;
  rows: number;
  quantity: number;
}

export interface AdminStatistics {
  users: { total: number; active: number; inactive: number; withWannabeId: number; withBadgeScan: number; cached: number };
  roles: Array<{ name: string; displayName: string; total: number }>;
  feedback: { total: number; pending: number; approved: number; onHold: number; inProgress: number; implemented: number; fixed: number; completedTotal: number; rejected: number; needsDatabaseFix: number; featureTotal: number; bugTotal: number };
  equipment: { totalItems: number; totalQuantity: number; availableQuantity: number; loanedQuantity: number; maintenanceQuantity: number; activeLoans: number; loanedOutQuantity: number; returnedLoans: number; returnedQuantity: number; loanEventsTotal: number; categories: AdminInventoryBreakdown[] };
  comms: { totalItems: number; totalQuantity: number; availableQuantity: number; loanedQuantity: number; totalSets: number; activeLoans: number; returnedLoans: number; loanedOutQuantity: number; returnedQuantity: number; loanEventsTotal: number; types: AdminInventoryBreakdown[] };
  vehicles: { total: number; available: number; loaned: number; maintenance: number; activeLoans: number; returnedLoans: number; loanEventsTotal: number; assignedTransportJobs: number };
  requests: { total: number; pending: number; partial: number; fulfilled: number; returned: number; rejected: number; requestedQuantity: number; requestLines: number };
  transport: { total: number; open: number; assigned: number; inProgress: number; completed: number; peopleTransport: number; equipmentTransport: number };
  tasks: { total: number; notStarted: number; inProgress: number; blocked: number; completed: number; linkedToTransport: number };
  shop: { categories: number; items: number; totalQuantity: number; checkoutCount: number; checkoutQuantity: number; checkinCount: number; checkinQuantity: number; movementsTotal: number };
  privateEquipment: { prefixRules: number };
  locations: { total: number; withAddress: number; types: AdminCountBreakdown[] };
  warehouse: { pallets: number; slots: number; occupiedSlots: number };
}

export interface AdminCrewResetPreview {
  confirmationPhrase: string;
  preservedUser: { id: number; name: string; email: string } | null;
  deletes: {
    users: number;
    crewCache: number;
    competencies: number;
    vehicleKdo: number;
    passwordResetTokens: number;
    feedbackNotificationReads: number;
    feedbackEntries: number;
    tasks: number;
    authAccounts: number;
    userRoles: number;
    equipmentRequests: number;
    equipmentLoans: number;
    commsLoans: number;
    vehicleLoans: number;
    shopMovements: number;
    auditLogs: number;
    loginAttempts: number;
  };
  unlinks: { transportRequesters: number; transportAssignees: number };
  clearsProtectedUserBadge: boolean;
  cacheYear: number;
}

export interface DashboardSummary {
  activeLoans: number;
  activeVehicleLoans: number;
  activeTransportJobs: number;
  totalTransportDistance: number;
  equipmentPerLocation: Array<{ locationName: string; equipmentCount: number }>;
}

export interface GlobalSearchResponse {
  equipment: Array<{
    id: number;
    name: string;
    serialNumber: string;
    locationName: string | null;
    palletName: string | null;
    slotNumber: number | null;
  }>;
  loans: Array<{
    id: number;
    equipmentId: number;
    wannabeId: number;
    status: string;
    issuedAt: string;
  }>;
}
