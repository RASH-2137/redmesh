import { randomUUID } from "node:crypto";
import { withRlsContext } from "../../config/database.js";
import {
    generateRefreshToken,
    hashRefreshToken,
} from "./refresh-token.js";

const REFRESH_TOKEN_TTL_DAYS = 30;

interface SessionRecord {
    id: string;
    userId: string;
    familyId: string;
    expiresAt: Date;
    revokedAt: Date | null;
}

interface CreatedSession {
    session: SessionRecord;
    refreshToken: string;
}

function refreshExpiry(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + REFRESH_TOKEN_TTL_DAYS);
    return expiry;
}

export async function createSession(
    userId: string,
): Promise<CreatedSession> {
    return withRlsContext(userId, async (client) => {
        const sessionId = randomUUID();
        const familyId = sessionId;

        const refreshToken = generateRefreshToken();
        const refreshTokenHash = hashRefreshToken(refreshToken);
        const expiresAt = refreshExpiry();

        const result = await client.query<{
            id: string;
            userId: string;
            familyId: string;
            expiresAt: Date;
            revokedAt: Date | null;
        }>(
            `
            INSERT INTO sessions (
                id,
                user_id,
                refresh_token_hash,
                expires_at,
                family_id
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING
                id,
                user_id AS "userId",
                family_id AS "familyId",
                expires_at AS "expiresAt",
                revoked_at AS "revokedAt"
            `,
            [
                sessionId,
                userId,
                refreshTokenHash,
                expiresAt,
                familyId,
            ],
        );

        const session = result.rows[0];

        if (!session) {
            throw new Error("Failed to create session");
        }

        return {
            session,
            refreshToken,
        };
    });
}

export async function revokeSession(
    sessionId: string,
    userId: string,
): Promise<void> {
    await withRlsContext(userId, async (client) => {
        await client.query(
            `
            UPDATE sessions
            SET revoked_at = NOW()
            WHERE id = $1
              AND revoked_at IS NULL
            `,
            [sessionId],
        );
    });
}

export async function revokeSessionFamily(
    familyId: string,
    userId: string,
): Promise<void> {
    await withRlsContext(userId, async (client) => {
        await client.query(
            `
            UPDATE sessions
            SET revoked_at = NOW()
            WHERE family_id = $1
              AND revoked_at IS NULL
            `,
            [familyId],
        );
    });
}

export async function isSessionActive(
    sessionId: string,
    userId: string,
): Promise<boolean> {
    return withRlsContext(userId, async (client) => {
        const result = await client.query<{ exists: boolean }>(
            `
            SELECT EXISTS (
                SELECT 1
                FROM sessions
                WHERE id = $1
                  AND revoked_at IS NULL
                  AND expires_at > NOW()
            ) AS exists
            `,
            [sessionId],
        );

        return result.rows[0]?.exists ?? false;
    });
}