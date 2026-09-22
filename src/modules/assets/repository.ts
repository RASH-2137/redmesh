import {
    withRlsContext,
} from "../../config/database.js";

export interface AssetRecord {
    id: string;
    name: string;
    classification:
        | "CONFIDENTIAL"
        | "SECRET"
        | "TOP_SECRET";
    unitId: string;
    status: string;
}

export async function findAssetById(
    userId: string,
    assetId: string,
): Promise<AssetRecord | null> {
    return withRlsContext(
        userId,
        async (client) => {
            const result =
                await client.query<AssetRecord>(
                    `
                    SELECT
                        id,
                        name,
                        classification,
                        unit_id AS "unitId",
                        status
                    FROM assets
                    WHERE id = $1
                    `,
                    [assetId],
                );

            return result.rows[0] ?? null;
        },
    );
}

export async function findAllAssets(
    userId: string,
): Promise<AssetRecord[]> {
    return withRlsContext(
        userId,
        async (client) => {
            const result =
                await client.query<AssetRecord>(
                    `
                    SELECT
                        id,
                        name,
                        classification,
                        unit_id AS "unitId",
                        status
                    FROM assets
                    ORDER BY name ASC
                    `,
                );

            return result.rows;
        },
    );
}