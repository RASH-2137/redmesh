import { sign, verify } from "paseto-ts/v4";

const ACCESS_TOKEN_TTL = "5 minutes";
const ISSUER = "redmesh-api";
const AUDIENCE = "redmesh";

export interface AccessTokenPayload {
    sub: string;
    sid: string;
    purpose: "access";
    iss: typeof ISSUER;
    aud: typeof AUDIENCE;
    iat?: string;
    exp?: string;
}

function getSecretKey(): string {
    const value = process.env.PASETO_SECRET_KEY;

    if (!value) {
        throw new Error("PASETO_SECRET_KEY is not configured");
    }

    return value;
}

function getPublicKey(): string {
    const value = process.env.PASETO_PUBLIC_KEY;

    if (!value) {
        throw new Error("PASETO_PUBLIC_KEY is not configured");
    }

    return value;
}

export async function createAccessToken(
    userId: string,
    sessionId: string,
): Promise<string> {
    const payload = {
        sub: userId,
        sid: sessionId,
        purpose: "access" as const,
        iss: ISSUER,
        aud: AUDIENCE,
        exp: ACCESS_TOKEN_TTL,
    };

    return sign(getSecretKey(), payload);
}

export async function verifyAccessToken(
    token: string,
): Promise<AccessTokenPayload> {
    const result = await verify<AccessTokenPayload>(
        getPublicKey(),
        token,
    );

    const payload = result.payload;

    if (payload.purpose !== "access") {
        throw new Error("Invalid token purpose");
    }

    if (payload.iss !== ISSUER) {
        throw new Error("Invalid token issuer");
    }

    if (payload.aud !== AUDIENCE) {
        throw new Error("Invalid token audience");
    }

    if (!payload.sub || !payload.sid) {
        throw new Error("Invalid token subject or session");
    }

    return payload;
}