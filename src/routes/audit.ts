import type {
    FastifyInstance,
    FastifyReply,
    FastifyRequest,
} from "fastify";

import {
    getAuthenticatedUser,
} from "../modules/auth/service.js";

import {
    verifyAccessToken,
} from "../modules/auth/tokens.js";

import {
    verifyAuditChain,
} from "../modules/audit/verifier.js";
import {
    findAuditEvents,
} from "../modules/audit/repository.js";

function getBearerToken(
    request: FastifyRequest,
): string | null {
    const authorization =
        request.headers.authorization;

    if (!authorization) {
        return null;
    }

    const [scheme, token] =
        authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
        return null;
    }

    return token;
}

async function requireAuditAccess(
    request: FastifyRequest,
    reply: FastifyReply,
) {
    const token = getBearerToken(request);

    if (!token) {
        await reply.code(401).send({
            error: "Unauthorized",
        });

        return null;
    }

    try {
        const payload =
            await verifyAccessToken(token);

        const user =
            await getAuthenticatedUser(
                payload.sub,
                payload.sid,
            );

        if (!user) {
            await reply.code(401).send({
                error: "Unauthorized",
            });

            return null;
        }

        const hasAuditRole =
            user.roles.includes("AUDITOR") ||
            user.roles.includes("ADMIN");

        if (!hasAuditRole) {
            await reply.code(403).send({
                error: "Forbidden",
            });

            return null;
        }

        return user;
    } catch {
        await reply.code(401).send({
            error: "Unauthorized",
        });

        return null;
    }
}

export async function auditRoutes(
    app: FastifyInstance,
): Promise<void> {
    app.get(
        "/audit/integrity",
        async (request, reply) => {
            const user =
                await requireAuditAccess(
                    request,
                    reply,
                );

            if (!user) {
                return;
            }

            const verification =
                await verifyAuditChain(user.id);

            return reply.code(200).send({
                verification,
            });
        },
    );

    app.get(
        "/audit/events",
        async (request, reply) => {
            const user =
                await requireAuditAccess(
                    request,
                    reply,
                );

            if (!user) {
                return;
            }

            const events =
                await findAuditEvents(user.id);

            return reply.code(200).send({
                events,
            });
        },
    );
}