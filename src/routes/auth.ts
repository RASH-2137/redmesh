import type {
    FastifyInstance,
    FastifyReply,
    FastifyRequest,
} from "fastify";
import {
    authenticate,
    getAuthenticatedUser,
    logout,
    refresh,
} from "../modules/auth/service.js";
import { verifyAccessToken } from "../modules/auth/tokens.js";

interface LoginBody {
    username: string;
    password: string;
}

interface RefreshBody {
    refreshToken: string;
}

function getBearerToken(
    request: FastifyRequest,
): string | null {
    const authorization = request.headers.authorization;

    if (!authorization) {
        return null;
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
        return null;
    }

    return token;
}

async function requireAuthentication(
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<{
    userId: string;
    sessionId: string;
} | null> {
    const token = getBearerToken(request);

    if (!token) {
        await reply.code(401).send({
            error: "Unauthorized",
        });
        return null;
    }

    try {
        const payload = await verifyAccessToken(token);

        const user = await getAuthenticatedUser(
            payload.sub,
            payload.sid,
        );

        if (!user) {
            await reply.code(401).send({
                error: "Unauthorized",
            });
            return null;
        }

        return {
            userId: payload.sub,
            sessionId: payload.sid,
        };
    } catch (error) {
        request.log.error(
            { error },
            "Authentication failed",
        );

        await reply.code(401).send({
            error: "Unauthorized",
        });
        return null;
    }
}

export async function authRoutes(
    app: FastifyInstance,
): Promise<void> {
    app.get(
        "/auth/demo-credentials",
        async () => {
            return {
                password:
                    process.env.DEMO_ACCOUNT_PASSWORD ??
                    "password123",
            };
        },
    );

    app.post<{ Body: LoginBody }>(
        "/auth/login",
        async (request, reply) => {
            const username = request.body?.username?.trim();
            const password = request.body?.password;

            if (!username || !password) {
                return reply.code(400).send({
                    error: "Invalid request",
                });
            }

            const result = await authenticate(
                username,
                password,
            );

            if (!result) {
                return reply.code(401).send({
                    error: "Invalid credentials",
                });
            }

            return reply.code(200).send(result);
        },
    );

    app.post<{ Body: RefreshBody }>(
        "/auth/refresh",
        async (request, reply) => {
            const refreshToken =
                request.body?.refreshToken;

            if (!refreshToken) {
                return reply.code(400).send({
                    error: "Invalid request",
                });
            }

            const result = await refresh(refreshToken);

            if (!result) {
                return reply.code(401).send({
                    error: "Invalid refresh token",
                });
            }

            return reply.code(200).send(result);
        },
    );

    app.post(
        "/auth/logout",
        async (request, reply) => {
            const identity = await requireAuthentication(
                request,
                reply,
            );

            if (!identity) {
                return;
            }

            await logout(
                identity.sessionId,
                identity.userId,
            );

            return reply.code(204).send();
        },
    );

    app.get(
        "/auth/me",
        async (request, reply) => {
            const identity = await requireAuthentication(
                request,
                reply,
            );

            if (!identity) {
                return;
            }

            const user = await getAuthenticatedUser(
                identity.userId,
                identity.sessionId,
            );

            if (!user) {
                return reply.code(401).send({
                    error: "Unauthorized",
                });
            }

            return reply.code(200).send({
                user,
            });
        },
    );
}