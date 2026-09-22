import { withRlsContext } from "../../config/database.js";
import { getTraceContext } from "../../observability/context.js";

async function appendAuditEvent(
    client: import("pg").PoolClient,
    input: {
        action: string;
        resourceType: string;
        resourceId?: string | null;
        result: string;
        reason?: string | null;
        traceId?: string | null;
    },
): Promise<void> {
    const traceId =
        input.traceId ?? getTraceContext().traceId;

    await client.query(
        `
        SELECT app_append_audit_event(
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
        )
        `,
        [
            input.action,
            input.resourceType,
            input.resourceId ?? null,
            input.result,
            input.reason ?? null,
            null,
            traceId,
        ],
    );
}

export interface AccessRequestRecord {
    id: string;
    requesterId: string;
    assetId: string;
    action: string;
    status:
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "CANCELLED";
    reason: string | null;
    decidedBy: string | null;
    decidedAt: Date | null;
    createdAt: Date;
}

export interface ProvisioningRecord {
    id: string;
    accessRequestId: string;
    assetId: string;
    userId: string;
    status: "PROVISIONED" | "REVOKED";
    provisionedAt: Date;
    revokedAt: Date | null;
}

export async function createAccessRequest(
    userId: string,
    assetId: string,
    reason: string | null,
): Promise<AccessRequestRecord> {
    return withRlsContext(userId, async (client) => {
        const result = await client.query<AccessRequestRecord>(
            `
            INSERT INTO access_requests (
                requester_id,
                asset_id,
                action,
                reason
            )
            VALUES ($1, $2, 'asset:request', $3)
            RETURNING
                id,
                requester_id AS "requesterId",
                asset_id AS "assetId",
                action,
                status,
                reason,
                decided_by AS "decidedBy",
                decided_at AS "decidedAt",
                created_at AS "createdAt"
            `,
            [userId, assetId, reason],
        );

        if (!result.rows[0]) {
            throw new Error("Failed to create access request");
        }

        const request = result.rows[0];

        await appendAuditEvent(client, {
            action: "access_request.created",
            resourceType: "access_request",
            resourceId: request.id,
            result: "SUCCESS",
        });

        return request;
    });
}

export async function findAccessRequest(
    userId: string,
    requestId: string,
): Promise<AccessRequestRecord | null> {
    return withRlsContext(userId, async (client) => {
        const result = await client.query<AccessRequestRecord>(
            `
            SELECT
                id,
                requester_id AS "requesterId",
                asset_id AS "assetId",
                action,
                status,
                reason,
                decided_by AS "decidedBy",
                decided_at AS "decidedAt",
                created_at AS "createdAt"
            FROM access_requests
            WHERE id = $1
            `,
            [requestId],
        );

        return result.rows[0] ?? null;
    });
}

export async function decideAccessRequest(
    commanderId: string,
    requestId: string,
    status: "APPROVED" | "REJECTED",
): Promise<AccessRequestRecord | null> {
    return withRlsContext(commanderId, async (client) => {
        const result = await client.query<AccessRequestRecord>(
            `
            UPDATE access_requests
            SET
                status = $1,
                decided_by = $2,
                decided_at = NOW()
            WHERE id = $3
              AND status = 'PENDING'
            RETURNING
                id,
                requester_id AS "requesterId",
                asset_id AS "assetId",
                action,
                status,
                reason,
                decided_by AS "decidedBy",
                decided_at AS "decidedAt",
                created_at AS "createdAt"
            `,
            [status, commanderId, requestId],
        );

        if (!result.rows[0]) {
            return null;
        }

        const request = result.rows[0];

        await appendAuditEvent(client, {
            action:
                status === "APPROVED"
                    ? "access_request.approved"
                    : "access_request.rejected",
            resourceType: "access_request",
            resourceId: request.id,
            result: "SUCCESS",
        });

        return request;
    });
}

export async function createProvisioningRecord(
    commanderId: string,
    request: AccessRequestRecord,
): Promise<ProvisioningRecord> {
    return withRlsContext(commanderId, async (client) => {
        const result = await client.query<ProvisioningRecord>(
            `
            INSERT INTO provisioning_records (
                access_request_id,
                asset_id,
                user_id,
                status
            )
            VALUES ($1, $2, $3, 'PROVISIONED')
            RETURNING
                id,
                access_request_id AS "accessRequestId",
                asset_id AS "assetId",
                user_id AS "userId",
                status,
                provisioned_at AS "provisionedAt",
                revoked_at AS "revokedAt"
            `,
            [
                request.id,
                request.assetId,
                request.requesterId,
            ],
        );

        if (!result.rows[0]) {
            throw new Error(
                "Failed to create provisioning record",
            );
        }

        const provisioning = result.rows[0];

        await appendAuditEvent(client, {
            action: "provisioning.created",
            resourceType: "provisioning",
            resourceId: provisioning.id,
            result: "SUCCESS",
        });

        return provisioning;
    });
}

export async function findProvisioningRecord(
    userId: string,
    provisioningId: string,
): Promise<ProvisioningRecord | null> {
    return withRlsContext(userId, async (client) => {
        const result = await client.query<ProvisioningRecord>(
            `
            SELECT
                id,
                access_request_id AS "accessRequestId",
                asset_id AS "assetId",
                user_id AS "userId",
                status,
                provisioned_at AS "provisionedAt",
                revoked_at AS "revokedAt"
            FROM provisioning_records
            WHERE id = $1
            `,
            [provisioningId],
        );

        return result.rows[0] ?? null;
    });
}

export async function revokeProvisioningRecord(
    commanderId: string,
    provisioningId: string,
): Promise<ProvisioningRecord | null> {
    return withRlsContext(commanderId, async (client) => {
        const result = await client.query<ProvisioningRecord>(
            `
            UPDATE provisioning_records
            SET
                status = 'REVOKED',
                revoked_at = NOW()
            WHERE id = $1
              AND status = 'PROVISIONED'
            RETURNING
                id,
                access_request_id AS "accessRequestId",
                asset_id AS "assetId",
                user_id AS "userId",
                status,
                provisioned_at AS "provisionedAt",
                revoked_at AS "revokedAt"
            `,
            [provisioningId],
        );

        if (!result.rows[0]) {
            return null;
        }

        const provisioning = result.rows[0];

        await appendAuditEvent(client, {
            action: "provisioning.revoked",
            resourceType: "provisioning",
            resourceId: provisioning.id,
            result: "SUCCESS",
        });

        return provisioning;
    });
}

export interface AccessRequestDetailRecord extends AccessRequestRecord {
    assetName?: string;
    assetClassification?: string;
    requesterName?: string;
    requesterRole?: string;
    requesterUnit?: string;
}

export async function findAllAccessRequests(
    userId: string,
): Promise<AccessRequestDetailRecord[]> {
    return withRlsContext(userId, async (client) => {
        const result = await client.query<AccessRequestDetailRecord>(
            `
            SELECT
                ar.id,
                ar.requester_id AS "requesterId",
                u.display_name AS "requesterName",
                u.role_name AS "requesterRole",
                u.unit_code AS "requesterUnit",
                ar.asset_id AS "assetId",
                a.name AS "assetName",
                a.classification AS "assetClassification",
                ar.action,
                ar.status,
                ar.reason,
                ar.decided_by AS "decidedBy",
                ar.decided_at AS "decidedAt",
                ar.created_at AS "createdAt"
            FROM access_requests ar
            JOIN assets a ON a.id = ar.asset_id
            LEFT JOIN LATERAL app_get_user_summary(ar.requester_id) u ON true
            ORDER BY ar.created_at DESC
            `,
        );

        return result.rows;
    });
}

export interface ProvisioningDetailRecord extends ProvisioningRecord {
    assetName?: string;
    assetClassification?: string;
    userName?: string;
    userRole?: string;
    userUnit?: string;
}

export async function findAllProvisioningRecords(
    userId: string,
): Promise<ProvisioningDetailRecord[]> {
    return withRlsContext(userId, async (client) => {
        const result = await client.query<ProvisioningDetailRecord>(
            `
            SELECT
                pr.id,
                pr.access_request_id AS "accessRequestId",
                pr.asset_id AS "assetId",
                a.name AS "assetName",
                a.classification AS "assetClassification",
                pr.user_id AS "userId",
                u.display_name AS "userName",
                u.role_name AS "userRole",
                u.unit_code AS "userUnit",
                pr.status,
                pr.provisioned_at AS "provisionedAt",
                pr.revoked_at AS "revokedAt"
            FROM provisioning_records pr
            JOIN assets a ON a.id = pr.asset_id
            LEFT JOIN LATERAL app_get_user_summary(pr.user_id) u ON true
            ORDER BY pr.provisioned_at DESC
            `,
        );

        return result.rows;
    });
}