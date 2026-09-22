import test from "node:test";
import assert from "node:assert";
import { buildTestApp } from "./helpers.js";
import { setupTestUsers } from "./setup.js";
import { appPool, bootstrapPool } from "../src/config/database.js";
import { createAccessToken } from "../src/modules/auth/tokens.js";
import { createSession } from "../src/modules/auth/session.js";

test("Provisioning Security", async (t) => {
    await setupTestUsers();
    const app = await buildTestApp();

    t.after(async () => {
        await app.close();
        await appPool.end();
        await bootstrapPool.end();
    });

    const rahulId = "20000000-0000-0000-0000-000000000001"; // Mechanic
    const rahulSession = await createSession(rahulId);
    const rahulToken = await createAccessToken(rahulId, rahulSession.session.id);

    const alexId = "20000000-0000-0000-0000-000000000002"; // Commander
    const alexSession = await createSession(alexId);
    const alexToken = await createAccessToken(alexId, alexSession.session.id);

    const secretAsset = "30000000-0000-0000-0000-000000000001"; 
    
    let requestId: string;

    await t.test("Mechanic can request access", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/assets/${secretAsset}/requests`,
            headers: { authorization: `Bearer ${rahulToken}` },
            payload: { reason: "Need it" }
        });
        assert.strictEqual(response.statusCode, 201);
        const body = JSON.parse(response.payload);
        requestId = body.request.id;
    });

    await t.test("Mechanic cannot approve the request", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/access-requests/${requestId}/approve`,
            headers: { authorization: `Bearer ${rahulToken}` },
        });
        // RLS will allow seeing the request, but Cerbos will deny "asset:approve"
        assert.strictEqual(response.statusCode, 403);
    });

    await t.test("Commander can approve the request", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/access-requests/${requestId}/approve`,
            headers: { authorization: `Bearer ${alexToken}` },
        });
        assert.strictEqual(response.statusCode, 200);
    });

    await t.test("Mechanic cannot provision", async () => {
        const response = await app.inject({
            method: "POST",
            url: `/access-requests/${requestId}/provision`,
            headers: { authorization: `Bearer ${rahulToken}` },
        });
        assert.strictEqual(response.statusCode, 403);
    });
});
