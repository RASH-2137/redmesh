import test from "node:test";
import assert from "node:assert";
import { buildTestApp } from "./helpers.js";
import { setupTestUsers } from "./setup.js";
import { appPool, bootstrapPool } from "../src/config/database.js";

test("Authentication Security", async (t) => {
    await setupTestUsers();
    const app = await buildTestApp();

    t.after(async () => {
        await app.close();
        await appPool.end();
        await bootstrapPool.end();
    });

    await t.test("Valid login succeeds", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: {
                username: "rahul",
                password: "password123",
            },
        });
        
        assert.strictEqual(response.statusCode, 200, `Expected 200, got ${response.statusCode}: ${response.payload}`);
        const body = JSON.parse(response.payload);
        assert.ok(body.accessToken);
        assert.ok(body.refreshToken);

        const meResponse = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: {
                authorization: `Bearer ${body.accessToken}`,
            },
        });
        assert.strictEqual(meResponse.statusCode, 200);
        const meBody = JSON.parse(meResponse.payload);
        assert.strictEqual(meBody.user.username, "rahul");
    });

    await t.test("Invalid password is rejected", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: {
                username: "rahul",
                password: "wrongpassword",
            },
        });
        
        assert.strictEqual(response.statusCode, 401);
    });

    await t.test("Unknown username is rejected", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: {
                username: "unknown_user",
                password: "password123",
            },
        });
        
        assert.strictEqual(response.statusCode, 401);
    });

    await t.test("Missing/invalid authentication token is rejected", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: {
                authorization: "Bearer invalid_token",
            },
        });
        
        assert.strictEqual(response.statusCode, 401);
    });
});
