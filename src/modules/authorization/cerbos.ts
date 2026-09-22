import { randomUUID } from "node:crypto";

const CERBOS_URL =
    process.env.CERBOS_URL ?? "http://127.0.0.1:3592";

export type Clearance =
    | "CONFIDENTIAL"
    | "SECRET"
    | "TOP_SECRET";

export type AuthorizationAction =
    | "asset:view"
    | "asset:request"
    | "asset:approve"
    | "asset:reject"
    | "asset:provision"
    | "asset:revoke";

export interface AuthorizationPrincipal {
    id: string;
    roles: string[];
    clearance: Clearance;
    unitId: string;
}

export interface AuthorizationResource {
    id: string;
    kind: "redmesh:asset";
    classification: Clearance;
    unitId: string;
    assetType: string;
    state: string;
}

const clearanceLevel: Record<Clearance, number> = {
    CONFIDENTIAL: 1,
    SECRET: 2,
    TOP_SECRET: 3,
};

async function checkResources(
    principal: AuthorizationPrincipal,
    resource: AuthorizationResource,
    action: AuthorizationAction,
): Promise<boolean> {
    const response = await fetch(
        `${CERBOS_URL}/api/check/resources`,
        {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                requestId: randomUUID(),
                principal: {
                    id: principal.id,
                    roles: principal.roles,
                    attr: {
                        unit_id: principal.unitId,
                        clearance: principal.clearance,
                        clearance_level:
                            clearanceLevel[principal.clearance],
                    },
                },
                resources: [
                    {
                        actions: [action],
                        resource: {
                            id: resource.id,
                            kind: resource.kind,
                            attr: {
                                unit_id: resource.unitId,
                                classification:
                                    resource.classification,
                                classification_level:
                                    clearanceLevel[
                                        resource.classification
                                    ],
                                asset_type: resource.assetType,
                                state: resource.state,
                            },
                        },
                    },
                ],
            }),
        },
    );

    if (!response.ok) {
        throw new Error(
            `Cerbos request failed with status ${response.status}`,
        );
    }

    const data = await response.json() as {
        results?: Array<{
            actions?: Record<
                string,
                "EFFECT_ALLOW" | "EFFECT_DENY"
            >;
        }>;
    };

    return (
        data.results?.[0]?.actions?.[action] ===
        "EFFECT_ALLOW"
    );
}

export async function authorizeAsset(
    principal: AuthorizationPrincipal,
    resource: AuthorizationResource,
    action: AuthorizationAction,
): Promise<boolean> {
    return checkResources(
        principal,
        resource,
        action,
    );
}