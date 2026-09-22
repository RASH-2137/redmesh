export type Clearance = "CONFIDENTIAL" | "SECRET" | "TOP_SECRET";

export type Role = "MECHANIC" | "COMMANDER" | "AUDITOR" | "CONTRACTOR" | "ADMIN";

export interface User {
  id: string;
  username: string;
  displayName: string;
  clearance: Clearance;
  unitId: string;
  unitCode: string;
  isActive: boolean;
  roles: Role[];
}

export interface Asset {
  id: string;
  name: string;
  classification: Clearance;
  unitId: string;
  status: "AVAILABLE" | "PROVISIONED" | "MAINTENANCE" | "REVOKED";
  canView?: boolean;
  canRequest?: boolean;
}

export type AccessRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface AccessRequest {
  id: string;
  requesterId: string;
  requesterName?: string;
  requesterRole?: string;
  requesterUnit?: string;
  assetId: string;
  assetName?: string;
  assetClassification?: Clearance;
  action: string;
  status: AccessRequestStatus;
  reason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export type ProvisioningStatus = "PROVISIONED" | "REVOKED";

export interface ProvisioningRecord {
  id: string;
  accessRequestId: string;
  assetId: string;
  assetName?: string;
  assetClassification?: Clearance;
  userId: string;
  userName?: string;
  userRole?: string;
  userUnit?: string;
  status: ProvisioningStatus;
  provisionedAt: string;
  revokedAt: string | null;
}

export interface AuditVerification {
  valid: boolean;
  eventCount: number;
  firstInvalidPosition: number | null;
  reason: string | null;
}

export interface AuditEvent {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  result: string;
  reason: string | null;
  requestId: string | null;
  traceId: string | null;
  previousHash: string | null;
  currentHash: string | null;
  schemaVersion: number;
  chainPosition: number;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
