import test from "node:test";
import assert from "node:assert";
import { buildTestApp } from "./helpers.js";
import { setupTestUsers } from "./setup.js";
import { appPool, bootstrapPool } from "../src/config/database.js";
import { createAccessToken } from "../src/modules/auth/tokens.js";
import { createSession } from "../src/modules/auth/session.js";

test("Assets Security - RLS and Cerbos", async (t) => {
    await setupTestUsers();
    const app = await buildTestApp();

    t.after(async () => {
        await app.close();
        await appPool.end();
        await bootstrapPool.end();
    });

    const rahulId = "20000000-0000-0000-0000-000000000001";
    const rahulSession = await createSession(rahulId);
    const rahulToken = await createAccessToken(rahulId, rahulSession.session.id);

    const alexId = "20000000-0000-0000-0000-000000000002";
    const alexSession = await createSession(alexId);
    const alexToken = await createAccessToken(alexId, alexSession.session.id);

    const johnId = "20000000-0000-0000-0000-000000000003"; // unit 0002
    const johnSession = await createSession(johnId);
    const johnToken = await createAccessToken(johnId, johnSession.session.id);

    const secretAsset = "30000000-0000-0000-0000-000000000001"; // SECRET, unit 0001
    const tsAsset = "30000000-0000-0000-0000-000000000002"; // TOP_SECRET, unit 0001
    
    await t.test("Authorized user can access resource", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/assets/${secretAsset}`,
            headers: { authorization: `Bearer ${rahulToken}` },
        });
        assert.strictEqual(response.statusCode, 200);
    });

    await t.test("Insufficient clearance access is denied by Cerbos (403)", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/assets/${tsAsset}`,
            headers: { authorization: `Bearer ${rahulToken}` },
        });
        assert.strictEqual(response.statusCode, 403);
    });

    await t.test("Cross-unit access is denied by RLS (404)", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/assets/${secretAsset}`,
            headers: { authorization: `Bearer ${johnToken}` },
        });
        assert.strictEqual(response.statusCode, 404);
    });
});
