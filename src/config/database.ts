import { Pool, type PoolClient } from "pg";

const appDatabaseUrl = process.env.DATABASE_URL;
const bootstrapDatabaseUrl =
    process.env.DATABASE_BOOTSTRAP_URL ??
    process.env.DATABASE_URL;

if (!appDatabaseUrl) {
    throw new Error("DATABASE_URL is not configured");
}

export const appPool = new Pool({
    connectionString: appDatabaseUrl,
});

export const bootstrapPool = new Pool({
    connectionString: bootstrapDatabaseUrl,
});

// Backwards compatibility while we migrate modules.
export const pool = appPool;

export async function withRlsContext<T>(
    userId: string,
    callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
    const client = await appPool.connect();

    try {
        await client.query("BEGIN");

        await client.query(
            "SELECT set_config('app.user_id', $1, true)",
            [userId],
        );

        const result = await callback(client);

        await client.query("COMMIT");

        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function withBootstrapClient<T>(
    callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
    const client = await bootstrapPool.connect();

    try {
        return await callback(client);
    } finally {
        client.release();
    }
}