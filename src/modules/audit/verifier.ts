import { createHash } from "node:crypto";
import { withRlsContext } from "../../config/database.js";

interface AuditVerificationRow {
    id: string;
    occurredAt: string;
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

function canonicalValue(input: string | null): string {
    if (input === null) {
        return "-1:";
    }

    return `${input.length}:${input}`;
}

function canonicalizeV1(event: AuditVerificationRow): string {
    return (
        "schema_version=" +
        canonicalValue("1") +
        "|chain_position=" +
        canonicalValue(String(event.chainPosition)) +
        "|occurred_at=" +
        canonicalValue(event.occurredAt) +
        "|actor_user_id=" +
        canonicalValue(event.actorUserId) +
        "|action=" +
        canonicalValue(event.action) +
        "|resource_type=" +
        canonicalValue(event.resourceType) +
        "|resource_id=" +
        canonicalValue(event.resourceId) +
        "|result=" +
        canonicalValue(event.result) +
        "|reason=" +
        canonicalValue(event.reason) +
        "|request_id=" +
        canonicalValue(event.requestId) +
        "|trace_id=" +
        canonicalValue(event.traceId) +
        "|previous_hash=" +
        canonicalValue(event.previousHash)
    );
}

function hashCanonicalValue(canonical: string): string {
    return createHash("sha256")
        .update(canonical, "utf8")
        .digest("hex");
}

export interface AuditVerificationResult {
    valid: boolean;
    eventCount: number;
    firstInvalidPosition: number | null;
    reason: string | null;
}

export async function verifyAuditChain(
    userId: string,
): Promise<AuditVerificationResult> {
    return withRlsContext(userId, async (client) => {
        const result =
            await client.query<AuditVerificationRow>(
                `
                SELECT
                    id,
                    to_char(
                        occurred_at AT TIME ZONE 'UTC',
                        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                    ) AS "occurredAt",
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

        const events = result.rows;

        if (events.length === 0) {
            return {
                valid: true,
                eventCount: 0,
                firstInvalidPosition: null,
                reason: null,
            };
        }

        let previousHash: string | null = null;

        for (const event of events) {
            if (event.schemaVersion !== 1) {
                return {
                    valid: false,
                    eventCount: events.length,
                    firstInvalidPosition:
                        event.chainPosition,
                    reason:
                        `Unsupported audit schema version at position ${event.chainPosition}`,
                };
            }

            if (event.previousHash !== previousHash) {
                return {
                    valid: false,
                    eventCount: events.length,
                    firstInvalidPosition:
                        event.chainPosition,
                    reason:
                        `Previous hash mismatch at position ${event.chainPosition}`,
                };
            }

            const canonical =
                canonicalizeV1(event);

            const expectedHash =
                hashCanonicalValue(canonical);

            if (event.currentHash !== expectedHash) {
                return {
                    valid: false,
                    eventCount: events.length,
                    firstInvalidPosition:
                        event.chainPosition,
                    reason:
                        `Current hash mismatch at position ${event.chainPosition}`,
                };
            }

            previousHash = event.currentHash;
        }

        return {
            valid: true,
            eventCount: events.length,
            firstInvalidPosition: null,
            reason: null,
        };
    });
}