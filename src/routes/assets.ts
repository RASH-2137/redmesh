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
    findAssetById,
    findAllAssets,
} from "../modules/assets/repository.js";

import {
    authorizeAssetAction,
} from "../modules/authorization/service.js";

interface AssetParams {
    id: string;
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
) {
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

        return user;
    } catch {
        await reply.code(401).send({
            error: "Unauthorized",
        });
        return null;
    }
}

export async function assetRoutes(
    app: FastifyInstance,
): Promise<void> {
    app.get<{ Params: AssetParams }>(
        "/assets/:id",
        async (request, reply) => {
            const user = await requireAuthentication(
                request,
                reply,
            );

            if (!user) {
                return;
            }

            const asset = await findAssetById(
                user.id,
                request.params.id,
            );

            if (!asset) {
                return reply.code(404).send({
                    error: "Asset not found",
                });
            }

            const allowed =
                await authorizeAssetAction(
                    user,
                    asset,
                    "asset:view",
                );

            if (!allowed) {
                return reply.code(403).send({
                    error: "Forbidden",
                });
            }

            return reply.code(200).send({
                asset,
            });
        },
    );

    app.get(
        "/assets",
        async (request, reply) => {
            const user = await requireAuthentication(
                request,
                reply,
            );

            if (!user) {
                return;
            }

            const assets = await findAllAssets(user.id);

            // Enrich each asset with view authorization status for this user
            const enriched = await Promise.all(
                assets.map(async (asset) => {
                    const canView = await authorizeAssetAction(
                        user,
                        asset,
                        "asset:view",
                    );
                    const canRequest = await authorizeAssetAction(
                        user,
                        asset,
                        "asset:request",
                    );
                    return {
                        ...asset,
                        canView,
                        canRequest,
                    };
                }),
            );

            return reply.code(200).send({
                assets: enriched,
            });
        },
    );
}