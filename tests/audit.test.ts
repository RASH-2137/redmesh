import test from "node:test";
import assert from "node:assert";
import { buildTestApp } from "./helpers.js";
import { setupTestUsers } from "./setup.js";
import { appPool, bootstrapPool } from "../src/config/database.js";
import { createAccessToken } from "../src/modules/auth/tokens.js";
import { createSession } from "../src/modules/auth/session.js";
import { appendAuditEvent } from "../src/modules/audit/repository.js";
import { Client } from "pg";

test("Audit Security", async (t) => {
    await setupTestUsers();
    const app = await buildTestApp();

    t.after(async () => {
        await app.close();
        await appPool.end();
        await bootstrapPool.end();
    });

    const adminId = "20000000-0000-0000-0000-000000000009"; // ADMIN
    const adminSession = await createSession(adminId);
    const adminToken = await createAccessToken(adminId, adminSession.session.id);

    const rahulId = "20000000-0000-0000-0000-000000000001"; // Mechanic

    await t.test("Legitimate audit events form a valid chain", async () => {
        // Guarantee at least one audit event exists
        await appendAuditEvent(adminId, {
            action: "TEST_ACTION",
            resourceType: "TEST_RESOURCE",
            result: "SUCCESS"
        });

        const response = await app.inject({
            method: "GET",
            url: "/audit/integrity",
            headers: { authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.verification.valid, true, `Expected valid chain, got reason: ${body.verification.reason}`);
    });

    await t.test("Modifying an event's content causes verification to fail", async () => {
        const client = new Client({
            connectionString: `postgresql://redmesh:${process.env.POSTGRES_PASSWORD}@127.0.0.1:5433/redmesh`
        });
        await client.connect();

        let eventId: string | undefined;
        let originalAction: string | undefined;
        try {
            // Find the last event and modify its action
            const res = await client.query("SELECT id, action FROM audit_events ORDER BY chain_position DESC LIMIT 1");
            eventId = res.rows[0].id;
            originalAction = res.rows[0].action;

            await client.query("UPDATE audit_events SET action = 'TAMPERED' WHERE id = $1", [eventId]);

            const response = await app.inject({
                method: "GET",
                url: "/audit/integrity",
                headers: { authorization: `Bearer ${adminToken}` },
            });
            assert.strictEqual(response.statusCode, 200);
            const body = JSON.parse(response.payload);
            assert.strictEqual(body.verification.valid, false, `Expected invalid, but got valid: ${JSON.stringify(body)}`);
            assert.ok(body.verification.reason.includes("Current hash mismatch"), `Expected current hash mismatch, got: ${body.verification.reason}`);
        } finally {
            if (eventId && originalAction) {
                await client.query("UPDATE audit_events SET action = $1 WHERE id = $2", [originalAction, eventId]);
            }
            await client.end();
        }
    });

    await t.test("Modifying a previous hash causes verification to fail", async () => {
        const client = new Client({
            connectionString: `postgresql://redmesh:${process.env.POSTGRES_PASSWORD}@127.0.0.1:5433/redmesh`
        });
        await client.connect();

        let eventId: string | undefined;
        let originalHash: string | undefined;
        try {
            // Tamper with previous_hash
            const res = await client.query("SELECT id, previous_hash FROM audit_events ORDER BY chain_position DESC LIMIT 1");
            eventId = res.rows[0].id;
            originalHash = res.rows[0].previous_hash;

            await client.query("UPDATE audit_events SET previous_hash = 'fakehash' WHERE id = $1", [eventId]);

            const response = await app.inject({
                method: "GET",
                url: "/audit/integrity",
                headers: { authorization: `Bearer ${adminToken}` },
            });
            assert.strictEqual(response.statusCode, 200);
            const body = JSON.parse(response.payload);
            assert.strictEqual(body.verification.valid, false, `Expected invalid, but got valid: ${JSON.stringify(body)}`);
            assert.ok(body.verification.reason.includes("Previous hash mismatch"), `Expected previous hash mismatch, got: ${body.verification.reason}`);
        } finally {
            if (eventId && originalHash !== undefined) {
                await client.query("UPDATE audit_events SET previous_hash = $1 WHERE id = $2", [originalHash, eventId]);
            }
            await client.end();
        }
    });
});
