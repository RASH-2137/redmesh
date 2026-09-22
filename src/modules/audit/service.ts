import {
    appendAuditEvent,
    type AppendAuditEventInput,
    type AuditEventRecord,
} from "./repository.js";

export async function recordAuditEvent(
    userId: string,
    input: AppendAuditEventInput,
): Promise<AuditEventRecord> {
    return appendAuditEvent(userId, input);
}