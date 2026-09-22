import test from "node:test";
import assert from "node:assert";
import { buildTestApp } from "./helpers.js";
import { setupTestUsers, applyCleanWorkflowSeed } from "./setup.js";
import { appPool, bootstrapPool } from "../src/config/database.js";

test("Targeted Productization & Workflow Verification", async (t) => {
    await setupTestUsers();
    await applyCleanWorkflowSeed();
    const app = await buildTestApp();

    t.after(async () => {
        await applyCleanWorkflowSeed();
        await app.close();
        await appPool.end();
        await bootstrapPool.end();
    });

    let alexToken = "";
    let rahulToken = "";
    let adminToken = "";
    let pendingRequestId = "";
    let approvedRequestId = "";

    await t.test("1. Commander Alex Login & Identity Verification", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { username: "alex", password: "password123" },
        });
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.ok(data.accessToken);
        alexToken = data.accessToken;

        const meRes = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: { authorization: `Bearer ${alexToken}` },
        });
        assert.strictEqual(meRes.statusCode, 200);
        const meData = JSON.parse(meRes.payload);
        assert.strictEqual(meData.user.username, "alex");
        assert.strictEqual(meData.user.clearance, "TOP_SECRET");
        assert.ok(meData.user.roles.includes("COMMANDER"));
    });

    await t.test("2. Access Requests List returns resolved requester identity (display name, role, unit)", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/access-requests",
            headers: { authorization: `Bearer ${alexToken}` },
        });
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.ok(Array.isArray(data.requests));
        assert.ok(data.requests.length >= 2, "Should have seeded requests");

        const pending = data.requests.find((r: any) => r.status === "PENDING");
        assert.ok(pending, "Must have a PENDING request");
        pendingRequestId = pending.id;
        assert.strictEqual(pending.requesterName, "Rahul", "Requester name must be resolved from DB");
        assert.strictEqual(pending.requesterRole, "MECHANIC", "Requester role must be resolved from DB");
        assert.strictEqual(pending.requesterUnit, "AIR-17", "Requester unit must be resolved from DB");

        const approved = data.requests.find((r: any) => r.status === "APPROVED");
        assert.ok(approved, "Must have an APPROVED request");
        approvedRequestId = approved.id;
        assert.strictEqual(approved.requesterName, "Rahul");
    });

    await t.test("3. Commander Approves Pending Request (POST without body)", async () => {
        const res = await app.inject({
            method: "POST",
            url: `/access-requests/${pendingRequestId}/approve`,
            headers: { authorization: `Bearer ${alexToken}` },
        });
        assert.strictEqual(res.statusCode, 200, "Approval must succeed without 400 Bad Request");
        const data = JSON.parse(res.payload);
        assert.strictEqual(data.request.status, "APPROVED");
    });

    await t.test("4. Commander Provisions Approved Request (POST without body)", async () => {
        const res = await app.inject({
            method: "POST",
            url: `/access-requests/${approvedRequestId}/provision`,
            headers: { authorization: `Bearer ${alexToken}` },
        });
        assert.strictEqual(res.statusCode, 201, "Provisioning must succeed without 400 Bad Request");
        const data = JSON.parse(res.payload);
        assert.strictEqual(data.provisioning.status, "PROVISIONED");
    });

    await t.test("5. Provisioning List returns resolved user identity", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/provisioning",
            headers: { authorization: `Bearer ${alexToken}` },
        });
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.ok(Array.isArray(data.provisioning));
        const active = data.provisioning.find((p: any) => p.status === "PROVISIONED");
        assert.ok(active, "Must have active provisioned assignment");
        assert.strictEqual(active.userName, "Rahul", "User name must be resolved from DB");
        assert.strictEqual(active.userRole, "MECHANIC", "User role must be resolved from DB");
        assert.strictEqual(active.userUnit, "AIR-17", "User unit must be resolved from DB");
    });

    await t.test("6. Mechanic Rahul Login & Unauthorized Action Denials (Authoritative Backend Checks)", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { username: "rahul", password: "password123" },
        });
        assert.strictEqual(res.statusCode, 200);
        rahulToken = JSON.parse(res.payload).accessToken;

        // Rahul attempts to approve -> 403
        const approveDenied = await app.inject({
            method: "POST",
            url: `/access-requests/${pendingRequestId}/approve`,
            headers: { authorization: `Bearer ${rahulToken}` },
        });
        assert.strictEqual(approveDenied.statusCode, 403, "Mechanic must be denied approval authority by Cerbos");

        // Rahul attempts to provision -> 403
        const provisionDenied = await app.inject({
            method: "POST",
            url: `/access-requests/${approvedRequestId}/provision`,
            headers: { authorization: `Bearer ${rahulToken}` },
        });
        assert.strictEqual(provisionDenied.statusCode, 403, "Mechanic must be denied provisioning authority by Cerbos");

        // Rahul attempts direct access to audit -> 403
        const auditDenied = await app.inject({
            method: "GET",
            url: "/audit/integrity",
            headers: { authorization: `Bearer ${rahulToken}` },
        });
        assert.strictEqual(auditDenied.statusCode, 403, "Mechanic must be denied audit access");

        // Rahul inspects TOP_SECRET Radar Module -> 403
        const radarDenied = await app.inject({
            method: "GET",
            url: "/assets/30000000-0000-0000-0000-000000000002",
            headers: { authorization: `Bearer ${rahulToken}` },
        });
        assert.strictEqual(radarDenied.statusCode, 403, "Clearance denial: SECRET user cannot inspect TOP_SECRET asset");
    });

    await t.test("7. Auditor / Admin Access & Cryptographic Audit Chain Integrity", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { username: "admin", password: "password123" },
        });
        assert.strictEqual(res.statusCode, 200);
        adminToken = JSON.parse(res.payload).accessToken;

        const auditRes = await app.inject({
            method: "GET",
            url: "/audit/integrity",
            headers: { authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(auditRes.statusCode, 200);
        const auditData = JSON.parse(auditRes.payload);
        assert.strictEqual(auditData.verification.valid, true, "Audit chain must verify as valid");
        assert.strictEqual(auditData.verification.firstInvalidPosition, null);
    });
});
