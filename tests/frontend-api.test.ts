import test from "node:test";
import assert from "node:assert";
import { buildTestApp } from "./helpers.js";
import { setupTestUsers } from "./setup.js";
import { appPool, bootstrapPool } from "../src/config/database.js";

test("Frontend API & Workflows Integration", async (t) => {
    await setupTestUsers();
    const app = await buildTestApp();

    t.after(async () => {
        await app.close();
        await appPool.end();
        await bootstrapPool.end();
    });

    let rahulToken = "";
    let rahulRefreshToken = "";
    let rahulId = "";
    let alexToken = "";
    let adminToken = "";
    let targetAssetId = "";
    let createdRequestId = "";
    let createdProvisioningId = "";

    await t.test("1. Login as Rahul (MECHANIC, SECRET)", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { username: "rahul", password: "password123" },
        });
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.ok(data.accessToken);
        assert.ok(data.refreshToken);
        rahulToken = data.accessToken;
        rahulRefreshToken = data.refreshToken;
    });

    await t.test("2. Verify /auth/me for Rahul", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: { authorization: `Bearer ${rahulToken}` },
        });
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.ok(data.user.id);
        assert.strictEqual(data.user.username, "rahul");
        assert.ok(data.user.roles.includes("MECHANIC"));
        assert.strictEqual(data.user.clearance, "SECRET");
        rahulId = data.user.id;
    });

    await t.test("3. Fetch /assets as Rahul (RLS filtered to unit)", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/assets",
            headers: { authorization: `Bearer ${rahulToken}` },
        });
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.ok(Array.isArray(data.assets));
        assert.ok(data.assets.length > 0);
        for (const asset of data.assets) {
            assert.strictEqual(asset.unitId, "10000000-0000-0000-0000-000000000001");
        }
        const secretAsset = data.assets.find((a: any) => a.classification === "SECRET");
        assert.ok(secretAsset, "Secret asset should exist");
        targetAssetId = secretAsset.id;
    });

    await t.test("4. Inspect specific asset via GET /assets/:id", async () => {
        const res = await app.inject({
            method: "GET",
            url: `/assets/${targetAssetId}`,
            headers: { authorization: `Bearer ${rahulToken}` },
        });
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.strictEqual(data.asset.id, targetAssetId);
    });

    await t.test("5. Create Access Request as Rahul via POST /assets/:id/requests", async () => {
        const res = await app.inject({
            method: "POST",
            url: `/assets/${targetAssetId}/requests`,
            headers: { authorization: `Bearer ${rahulToken}` },
            payload: { reason: "Urgent maintenance requirement" },
        });
        assert.strictEqual(res.statusCode, 201);
        const data = JSON.parse(res.payload);
        assert.ok(data.request.id);
        assert.strictEqual(data.request.status, "PENDING");
        createdRequestId = data.request.id;
    });

    await t.test("6. Verify Rahul cannot approve their own request (Cerbos 403)", async () => {
        const res = await app.inject({
            method: "POST",
            url: `/access-requests/${createdRequestId}/approve`,
            headers: { authorization: `Bearer ${rahulToken}` },
        });
        assert.strictEqual(res.statusCode, 403);
    });

    await t.test("7. Login as Alex (COMMANDER, TOP_SECRET)", async () => {
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
        assert.ok(meData.user.roles.includes("COMMANDER"));
        assert.strictEqual(meData.user.clearance, "TOP_SECRET");
    });

    await t.test("8. List access requests via GET /access-requests as Alex", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/access-requests",
            headers: { authorization: `Bearer ${alexToken}` },
        });
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.ok(Array.isArray(data.requests));
        const found = data.requests.some((r: any) => r.id === createdRequestId);
        assert.ok(found, "Newly created access request should appear in list");
    });

    await t.test("9. Approve access request as Alex via POST /access-requests/:id/approve", async () => {
        const res = await app.inject({
            method: "POST",
            url: `/access-requests/${createdRequestId}/approve`,
            headers: { authorization: `Bearer ${alexToken}` },
        });
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.strictEqual(data.request.status, "APPROVED");
    });

    await t.test("10. Provision access request via POST /access-requests/:id/provision as Alex", async () => {
        const res = await app.inject({
            method: "POST",
            url: `/access-requests/${createdRequestId}/provision`,
            headers: { authorization: `Bearer ${alexToken}` },
        });
        assert.strictEqual(res.statusCode, 201);
        const data = JSON.parse(res.payload);
        assert.ok(data.provisioning.id);
        assert.strictEqual(data.provisioning.status, "PROVISIONED");
        createdProvisioningId = data.provisioning.id;
    });

    await t.test("11. List provisioning records via GET /provisioning as Alex", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/provisioning",
            headers: { authorization: `Bearer ${alexToken}` },
        });
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.ok(Array.isArray(data.provisioning));
        const found = data.provisioning.some((p: any) => p.id === createdProvisioningId);
        assert.ok(found, "Provisioned record should appear in list");
    });

    await t.test("12. Revoke provisioning record via POST /provisioning/:id/revoke as Alex", async () => {
        const res = await app.inject({
            method: "POST",
            url: `/provisioning/${createdProvisioningId}/revoke`,
            headers: { authorization: `Bearer ${alexToken}` },
        });
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.strictEqual(data.provisioning.status, "REVOKED");
    });

    await t.test("13. Login as Admin and verify audit chain integrity via GET /audit/integrity", async () => {
        const loginRes = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { username: "admin", password: "password123" },
        });
        assert.strictEqual(loginRes.statusCode, 200);
        const loginData = JSON.parse(loginRes.payload);
        adminToken = loginData.accessToken;

        const res = await app.inject({
            method: "GET",
            url: "/audit/integrity",
            headers: { authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.strictEqual(data.verification.valid, true);
        assert.ok(data.verification.eventCount > 0);
    });

    await t.test("14. List audit events via GET /audit/events as Admin", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/audit/events",
            headers: { authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.ok(Array.isArray(data.events));
        assert.ok(data.events.length > 0);
        assert.ok(data.events[0].currentHash);
        assert.ok(data.events[0].action);
    });

    await t.test("15. Refresh access token via POST /auth/refresh", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/auth/refresh",
            payload: { refreshToken: rahulRefreshToken },
        });
        assert.strictEqual(res.statusCode, 200);
        const data = JSON.parse(res.payload);
        assert.ok(data.accessToken);
        assert.notStrictEqual(data.accessToken, rahulToken);
    });
});
