import type {
    FastifyInstance,
    FastifyReply,
    FastifyRequest,
} from "fastify";

import {
    verifyAccessToken,
} from "../modules/auth/tokens.js";

import {
    getAuthenticatedUser,
} from "../modules/auth/service.js";

import {
    findAssetById,
} from "../modules/assets/repository.js";

import {
    authorizeAssetAction,
} from "../modules/authorization/service.js";

import {
    createAccessRequest,
    findAccessRequest,
    decideAccessRequest,
    createProvisioningRecord,
    findProvisioningRecord,
    revokeProvisioningRecord,
    findAllAccessRequests,
    findAllProvisioningRecords,
} from "../modules/provisioning/repository.js";

interface AssetParams {
    id: string;
}

interface RequestParams {
    id: string;
}

interface ProvisioningParams {
    id: string;
}

interface RequestBody {
    reason?: string;
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

export async function provisioningRoutes(
    app: FastifyInstance,
): Promise<void> {

    // --------------------------------------------------------
    // REQUEST ACCESS
    // --------------------------------------------------------

    app.post<{
        Params: AssetParams;
        Body: RequestBody;
    }>(
        "/assets/:id/requests",
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
                    "asset:request",
                );

            if (!allowed) {
                return reply.code(403).send({
                    error: "Forbidden",
                });
            }

            const reason =
                request.body?.reason?.trim() || null;

            const accessRequest =
                await createAccessRequest(
                    user.id,
                    asset.id,
                    reason,
                );

            return reply.code(201).send({
                request: accessRequest,
            });
        },
    );


    // --------------------------------------------------------
    // APPROVE / REJECT
    // --------------------------------------------------------

    app.post<{
        Params: RequestParams;
    }>(
        "/access-requests/:id/approve",
        async (request, reply) => {
            const user = await requireAuthentication(
                request,
                reply,
            );

            if (!user) {
                return;
            }

            const accessRequest =
                await findAccessRequest(
                    user.id,
                    request.params.id,
                );

            if (!accessRequest) {
                return reply.code(404).send({
                    error: "Access request not found",
                });
            }

            const asset = await findAssetById(
                user.id,
                accessRequest.assetId,
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
                    "asset:approve",
                );

            if (!allowed) {
                return reply.code(403).send({
                    error: "Forbidden",
                });
            }

            const updated =
                await decideAccessRequest(
                    user.id,
                    accessRequest.id,
                    "APPROVED",
                );

            if (!updated) {
                return reply.code(409).send({
                    error: "Request is no longer pending",
                });
            }

            return reply.code(200).send({
                request: updated,
            });
        },
    );

    app.post<{
        Params: RequestParams;
    }>(
        "/access-requests/:id/reject",
        async (request, reply) => {
            const user = await requireAuthentication(
                request,
                reply,
            );

            if (!user) {
                return;
            }

            const accessRequest =
                await findAccessRequest(
                    user.id,
                    request.params.id,
                );

            if (!accessRequest) {
                return reply.code(404).send({
                    error: "Access request not found",
                });
            }

            const asset = await findAssetById(
                user.id,
                accessRequest.assetId,
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
                    "asset:reject",
                );

            if (!allowed) {
                return reply.code(403).send({
                    error: "Forbidden",
                });
            }

            const updated =
                await decideAccessRequest(
                    user.id,
                    accessRequest.id,
                    "REJECTED",
                );

            if (!updated) {
                return reply.code(409).send({
                    error: "Request is no longer pending",
                });
            }

            return reply.code(200).send({
                request: updated,
            });
        },
    );


    // --------------------------------------------------------
    // PROVISION
    // --------------------------------------------------------

    app.post<{
        Params: RequestParams;
    }>(
        "/access-requests/:id/provision",
        async (request, reply) => {
            const user = await requireAuthentication(
                request,
                reply,
            );

            if (!user) {
                return;
            }

            const accessRequest =
                await findAccessRequest(
                    user.id,
                    request.params.id,
                );

            if (!accessRequest) {
                return reply.code(404).send({
                    error: "Access request not found",
                });
            }

            if (accessRequest.status !== "APPROVED") {
                return reply.code(409).send({
                    error: "Access request is not approved",
                });
            }

            const asset = await findAssetById(
                user.id,
                accessRequest.assetId,
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
                    "asset:provision",
                );

            if (!allowed) {
                return reply.code(403).send({
                    error: "Forbidden",
                });
            }

            try {
                const provisioning =
                    await createProvisioningRecord(
                        user.id,
                        accessRequest,
                    );

                return reply.code(201).send({
                    provisioning,
                });
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message.includes(
                        "provisioning_records_access_request_unique",
                    )
                ) {
                    return reply.code(409).send({
                        error:
                            "Access request is already provisioned",
                    });
                }

                throw error;
            }
        },
    );


    // --------------------------------------------------------
    // REVOKE
    // --------------------------------------------------------

    app.post<{
        Params: ProvisioningParams;
    }>(
        "/provisioning/:id/revoke",
        async (request, reply) => {
            const user = await requireAuthentication(
                request,
                reply,
            );

            if (!user) {
                return;
            }

            const provisioning =
                await findProvisioningRecord(
                    user.id,
                    request.params.id,
                );

            if (!provisioning) {
                return reply.code(404).send({
                    error: "Provisioning record not found",
                });
            }

            const asset = await findAssetById(
                user.id,
                provisioning.assetId,
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
                    "asset:revoke",
                );

            if (!allowed) {
                return reply.code(403).send({
                    error: "Forbidden",
                });
            }

            const updated =
                await revokeProvisioningRecord(
                    user.id,
                    provisioning.id,
                );

            if (!updated) {
                return reply.code(409).send({
                    error:
                        "Provisioning record is already revoked",
                });
            }

            return reply.code(200).send({
                provisioning: updated,
            });
        },
    );

    // --------------------------------------------------------
    // LIST ACCESS REQUESTS (Under RLS)
    // --------------------------------------------------------

    app.get(
        "/access-requests",
        async (request, reply) => {
            const user = await requireAuthentication(
                request,
                reply,
            );

            if (!user) {
                return;
            }

            const requests = await findAllAccessRequests(user.id);

            return reply.code(200).send({
                requests,
            });
        },
    );

    // --------------------------------------------------------
    // LIST PROVISIONING RECORDS (Under RLS)
    // --------------------------------------------------------

    app.get(
        "/provisioning",
        async (request, reply) => {
            const user = await requireAuthentication(
                request,
                reply,
            );

            if (!user) {
                return;
            }

            const provisioning = await findAllProvisioningRecords(user.id);

            return reply.code(200).send({
                provisioning,
            });
        },
    );
}