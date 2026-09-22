import { Client } from "pg";
import argon2 from "argon2";

export async function setupTestUsers() {
    const password = "password123";
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const client = new Client({
        connectionString: `postgresql://redmesh:${process.env.POSTGRES_PASSWORD}@127.0.0.1:5433/redmesh`
    });
    await client.connect();
    try {
        await client.query("UPDATE users SET password_hash = $1 WHERE username IN ('rahul', 'alex', 'john')", [passwordHash]);
        // Insert admin user
        await client.query(`
            INSERT INTO users (id, username, display_name, clearance, unit_id, password_hash)
            VALUES ('20000000-0000-0000-0000-000000000009', 'admin', 'Admin', 'TOP_SECRET', '10000000-0000-0000-0000-000000000001', $1)
            ON CONFLICT DO NOTHING
        `, [passwordHash]);
        await client.query(`
            INSERT INTO user_roles (user_id, role_id)
            VALUES ('20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000005')
            ON CONFLICT DO NOTHING
        `);
    } finally {
        await client.end();
    }
}

export async function applyCleanWorkflowSeed() {
    const client = new Client({
        connectionString: `postgresql://redmesh:${process.env.POSTGRES_PASSWORD}@127.0.0.1:5433/redmesh`
    });
    await client.connect();
    try {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const { fileURLToPath } = await import("node:url");
        const dirname = path.dirname(fileURLToPath(import.meta.url));
        const seedPath = path.resolve(dirname, "../database/seeds/002_clean_workflow_data.sql");
        const seedSql = fs.readFileSync(seedPath, "utf-8");
        await client.query(seedSql);
    } finally {
        await client.end();
    }
}

