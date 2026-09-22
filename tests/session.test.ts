import test from "node:test";
import assert from "node:assert";
import { buildTestApp } from "./helpers.js";
import { setupTestUsers } from "./setup.js";
import { appPool, bootstrapPool } from "../src/config/database.js";

test("Session Security", async (t) => {
    await setupTestUsers();
    const app = await buildTestApp();

    t.after(async () => {
        await app.close();
        await appPool.end();
        await bootstrapPool.end();
    });

    let accessToken: string;
    let refreshToken: string;

    await t.test("Valid login creates session", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { username: "rahul", password: "password123" }
        });
        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.payload);
        accessToken = body.accessToken;
        refreshToken = body.refreshToken;
    });

    let newAccessToken: string;
    let newRefreshToken: string;

    await t.test("Refresh rotates credentials", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/refresh",
            payload: { refreshToken }
        });
        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.payload);
        newAccessToken = body.accessToken;
        newRefreshToken = body.refreshToken;
        assert.notStrictEqual(newAccessToken, accessToken);
        assert.notStrictEqual(newRefreshToken, refreshToken);
    });

    await t.test("Reusing old refresh token revokes entire session family", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/refresh",
            payload: { refreshToken }
        });
        assert.strictEqual(response.statusCode, 401);

        // Verify the new access token was also revoked because it belongs to the same family
        const meResponse = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: { authorization: `Bearer ${newAccessToken}` }
        });
        assert.strictEqual(meResponse.statusCode, 401);
    });

    await t.test("Logout invalidates session", async () => {
        // Create a fresh session to test logout
        const loginResponse = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { username: "rahul", password: "password123" }
        });
        const freshAccessToken = JSON.parse(loginResponse.payload).accessToken;

        const logoutResponse = await app.inject({
            method: "POST",
            url: "/auth/logout",
            headers: { authorization: `Bearer ${freshAccessToken}` }
        });
        assert.strictEqual(logoutResponse.statusCode, 204);

        const meResponse = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: { authorization: `Bearer ${freshAccessToken}` }
        });
        assert.strictEqual(meResponse.statusCode, 401);
    });
});
