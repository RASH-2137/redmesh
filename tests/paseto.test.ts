import test from "node:test";
import assert from "node:assert";
import { sign, verify } from "paseto-ts/v4";
import { createAccessToken, verifyAccessToken } from "../src/modules/auth/tokens.js";
import { randomUUID } from "node:crypto";
import { buildTestApp } from "./helpers.js";
import { appPool, bootstrapPool } from "../src/config/database.js";

test("PASETO Security", async (t) => {
    const app = await buildTestApp();

    t.after(async () => {
        await app.close();
        await appPool.end();
        await bootstrapPool.end();
    });

    const userId = randomUUID();
    const sessionId = randomUUID();

    await t.test("Valid PASETO verifies", async () => {
        const token = await createAccessToken(userId, sessionId);
        const payload = await verifyAccessToken(token);
        assert.strictEqual(payload.sub, userId);
        assert.strictEqual(payload.sid, sessionId);
    });

    await t.test("Tampered token fails verification", async () => {
        const token = await createAccessToken(userId, sessionId);
        const tampered = token.slice(0, -5) + "abcde";
        await assert.rejects(async () => {
            await verifyAccessToken(tampered);
        });
    });

    await t.test("Token with invalid purpose is rejected", async () => {
        const payload = {
            sub: userId,
            sid: sessionId,
            purpose: "refresh" as const,
            iss: "redmesh-api",
            aud: "redmesh",
        };
        const token = await sign(process.env.PASETO_SECRET_KEY!, payload);
        await assert.rejects(async () => {
            await verifyAccessToken(token as any);
        }, /Invalid token purpose/);
    });

    await t.test("Expired token is rejected", async () => {
        const payload = {
            sub: userId,
            sid: sessionId,
            purpose: "access" as const,
            iss: "redmesh-api",
            aud: "redmesh",
            exp: "1s",
        };
        const token = await sign(process.env.PASETO_SECRET_KEY!, payload);
        
        await new Promise(resolve => setTimeout(resolve, 1100));

        await assert.rejects(async () => {
            await verifyAccessToken(token as any);
        });
    });
});
