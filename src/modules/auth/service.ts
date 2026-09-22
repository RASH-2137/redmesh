import { randomBytes, randomUUID } from "node:crypto";
import {
    appPool,
    withBootstrapClient,
    withRlsContext,
} from "../../config/database.js";
import { verifyPassword } from "./password.js";
import { createAccessToken } from "./tokens.js";
import {
    createSession,
    isSessionActive,
    revokeSession,
} from "./session.js";
import { hashRefreshToken } from "./refresh-token.js";

let dummyPasswordHashPromise: Promise<string> | undefined;

async function getDummyPasswordHash(): Promise<string> {
    if (!dummyPasswordHashPromise) {
        const { hashPassword } = await import("./password.js");

        dummyPasswordHashPromise = hashPassword(
            randomBytes(32).toString("base64url"),
        );
    }

    return dummyPasswordHashPromise;
}

export interface LoginResult {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface AuthenticatedUser {
    id: string;
    username: string;
    displayName: string;
    clearance: "CONFIDENTIAL" | "SECRET" | "TOP_SECRET";
    unitId: string;
    unitCode: string;
    isActive: boolean;
    roles: string[];
}

interface LoginUser {
    id: string;
    passwordHash: string | null;
    isActive: boolean;
}

interface RefreshSession {
    id: string;
    userId: string;
    familyId: string;
    expiresAt: Date;
    revokedAt: Date | null;
}

export async function authenticate(
    username: string,
    password: string,
): Promise<LoginResult | null> {
    const user = await withBootstrapClient(async (client) => {
        const result = await client.query<LoginUser>(
            `
            SELECT
                id,
                password_hash AS "passwordHash",
                is_active AS "isActive"
            FROM app_authenticate_user($1)
            `,
            [username],
        );

        return result.rows[0] ?? null;
    });

    if (!user || !user.passwordHash || !user.isActive) {
        const dummyHash = await getDummyPasswordHash();
        await verifyPassword(dummyHash, password);
        return null;
    }

    const valid = await verifyPassword(
        user.passwordHash,
        password,
    );

    if (!valid) {
        return null;
    }

    const created = await createSession(user.id);

    const accessToken = await createAccessToken(
        user.id,
        created.session.id,
    );

    return {
        accessToken,
        refreshToken: created.refreshToken,
        expiresIn: 300,
    };
}

export async function refresh(
    refreshToken: string,
): Promise<LoginResult | null> {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const client = await appPool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query<RefreshSession>(
            `
            SELECT
                id,
                user_id AS "userId",
                family_id AS "familyId",
                expires_at AS "expiresAt",
                revoked_at AS "revokedAt"
            FROM app_find_session_by_refresh_token($1)
            `,
            [refreshTokenHash],
        );

        const session = result.rows[0];

        if (!session) {
            await client.query("ROLLBACK");
            return null;
        }

        await client.query(
            "SELECT set_config('app.user_id', $1, true)",
            [session.userId],
        );

        if (session.revokedAt) {
            await client.query(
                `
                UPDATE sessions
                SET revoked_at = NOW()
                WHERE family_id = $1
                  AND revoked_at IS NULL
                `,
                [session.familyId],
            );

            await client.query("COMMIT");
            return null;
        }

        if (session.expiresAt <= new Date()) {
            await client.query(
                `
                UPDATE sessions
                SET revoked_at = NOW()
                WHERE id = $1
                `,
                [session.id],
            );

            await client.query("COMMIT");
            return null;
        }

        const userResult = await client.query<{ isActive: boolean }>(
            `
            SELECT is_active AS "isActive"
            FROM users
            WHERE id = app_current_user_id()
            `,
        );

        const user = userResult.rows[0];

        if (!user || !user.isActive) {
            await client.query(
                `
                UPDATE sessions
                SET revoked_at = NOW()
                WHERE id = $1
                `,
                [session.id],
            );

            await client.query("COMMIT");
            return null;
        }

        const newSessionId = randomUUID();
        const newRefreshToken = randomBytes(48).toString("base64url");
        const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 30);

        await client.query(
            `
            INSERT INTO sessions (
                id,
                user_id,
                refresh_token_hash,
                expires_at,
                family_id
            )
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                newSessionId,
                session.userId,
                newRefreshTokenHash,
                newExpiresAt,
                session.familyId,
            ],
        );

        await client.query(
            `
            UPDATE sessions
            SET
                revoked_at = NOW(),
                replaced_by_session_id = $1,
                last_used_at = NOW()
            WHERE id = $2
            `,
            [newSessionId, session.id],
        );

        await client.query("COMMIT");

        const accessToken = await createAccessToken(
            session.userId,
            newSessionId,
        );

        return {
            accessToken,
            refreshToken: newRefreshToken,
            expiresIn: 300,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function logout(
    sessionId: string,
    userId: string,
): Promise<void> {
    const active = await isSessionActive(
        sessionId,
        userId,
    );

    if (active) {
        await revokeSession(sessionId, userId);
    }
}

export async function getAuthenticatedUser(
    userId: string,
    sessionId: string,
): Promise<AuthenticatedUser | null> {
    const sessionActive = await isSessionActive(
        sessionId,
        userId,
    );

    if (!sessionActive) {
        return null;
    }

    return withRlsContext(userId, async (client) => {
        const result = await client.query<AuthenticatedUser>(
            `
            SELECT
                u.id,
                u.username,
                u.display_name AS "displayName",
                u.clearance,
                u.unit_id AS "unitId",
                un.code AS "unitCode",
                u.is_active AS "isActive",
                COALESCE(
                    ARRAY_AGG(DISTINCT r.name)
                    FILTER (WHERE r.name IS NOT NULL),
                    '{}'
                ) AS roles
            FROM users u
            JOIN units un
                ON un.id = u.unit_id
            LEFT JOIN user_roles ur
                ON ur.user_id = u.id
            LEFT JOIN roles r
                ON r.id = ur.role_id
            WHERE u.id = app_current_user_id()
              AND u.is_active = TRUE
            GROUP BY
                u.id,
                u.username,
                u.display_name,
                u.clearance,
                u.unit_id,
                un.code,
                u.is_active
            `,
        );

        return result.rows[0] ?? null;
    });
}