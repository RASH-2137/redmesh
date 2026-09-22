import { withRlsContext } from "../../config/database.js";
import { getTraceContext } from "../../observability/context.js";

export interface AuditEventRecord {
    id: string;
    occurredAt: Date;
    actorUserId: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    result: string;
    reason: string | null;
    requestId: string | null;
    traceId: string | null;
    previousHash: string | null;
    currentHash: string;
    schemaVersion: number;
    chainPosition: number;
}

export interface AppendAuditEventInput {
    action: string;
    resourceType: string;
    resourceId?: string | null;
    result: string;
    reason?: string | null;
    requestId?: string | null;
    traceId?: string | null;
}

export async function appendAuditEvent(
    userId: string,
    input: AppendAuditEventInput,
): Promise<AuditEventRecord> {
    const traceContext = getTraceContext();
    const traceId = input.traceId ?? traceContext.traceId;

    return withRlsContext(
        userId,
        async (client) => {
            const result =
                await client.query<AuditEventRecord>(
                    `
                    SELECT
                        id,
                        occurred_at AS "occurredAt",
                        actor_user_id AS "actorUserId",
                        action,
                        resource_type AS "resourceType",
                        resource_id AS "resourceId",
                        result,
                        reason,
                        request_id AS "requestId",
                        trace_id AS "traceId",
                        previous_hash AS "previousHash",
                        current_hash AS "currentHash",
                        schema_version AS "schemaVersion",
                        chain_position AS "chainPosition"
                    FROM app_append_audit_event(
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
                        input.requestId ?? null,
                        traceId,
                    ],
                );

            const event = result.rows[0];

            if (!event) {
                throw new Error(
                    "Audit event was not created",
                );
            }

            return event;
        },
    );
}

export async function findAuditEvents(
    userId: string,
): Promise<AuditEventRecord[]> {
    return withRlsContext(
        userId,
        async (client) => {
            const result =
                await client.query<AuditEventRecord>(
                    `
                    SELECT
                        id,
                        occurred_at AS "occurredAt",
                        actor_user_id AS "actorUserId",
                        action,
                        resource_type AS "resourceType",
                        resource_id AS "resourceId",
                        result,
                        reason,
                        request_id AS "requestId",
                        trace_id AS "traceId",
                        previous_hash AS "previousHash",
                        current_hash AS "currentHash",
                        schema_version AS "schemaVersion",
                        chain_position AS "chainPosition"
                    FROM audit_events
                    ORDER BY chain_position ASC
                    `,
                );

            return result.rows;
        },
    );
}