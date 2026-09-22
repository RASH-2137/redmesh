import {
    authorizeAsset,
    type AuthorizationAction,
    type AuthorizationPrincipal,
    type AuthorizationResource,
} from "./cerbos.js";
import type { AssetRecord } from "../assets/repository.js";

export interface AuthorizationUser {
    id: string;
    roles: string[];
    clearance:
        | "CONFIDENTIAL"
        | "SECRET"
        | "TOP_SECRET";
    unitId: string;
}

export async function authorizeAssetAction(
    user: AuthorizationUser,
    asset: AssetRecord,
    action: AuthorizationAction,
): Promise<boolean> {
    const principal: AuthorizationPrincipal = {
        id: user.id,
        roles: user.roles,
        clearance: user.clearance,
        unitId: user.unitId,
    };

    const resource: AuthorizationResource = {
        id: asset.id,
        kind: "redmesh:asset",
        classification: asset.classification,
        unitId: asset.unitId,
        assetType: asset.name,
        state: asset.status,
    };

    return authorizeAsset(
        principal,
        resource,
        action,
    );
}