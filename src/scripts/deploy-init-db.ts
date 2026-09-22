import "dotenv/config";
import { Client } from "pg";
import argon2 from "argon2";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyAuditChain } from "../modules/audit/verifier.js";
import { appPool } from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

export async function deployInitDb(): Promise<void> {
  const adminUrl =
    process.env.ADMIN_DATABASE_URL ||
    `postgresql://redmesh:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || "127.0.0.1"}:${process.env.POSTGRES_PORT || "5433"}/redmesh`;
  const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD || "password123";
  const appPassword = process.env.REDMESH_APP_PASSWORD;
  const authPassword = process.env.REDMESH_AUTH_PASSWORD;

  console.log("[deploy-init-db] Connecting to PostgreSQL as admin...");
  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  try {
    // Ensure schema_migrations table exists for idempotent migration tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Check if initial schema already exists from prior setup
    const tableCheck = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'roles'
      );
    `);
    const initialSchemaExists = tableCheck.rows[0]?.exists ?? false;

    const appliedRows = await client.query<{ version: string }>(
      "SELECT version FROM schema_migrations",
    );
    const appliedVersions = new Set(appliedRows.rows.map((r) => r.version));

    // 1. Run migrations 001 - 014 in strict numerical order
    const migrationsDir = path.join(rootDir, "database/migrations");
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    console.log(
      `[deploy-init-db] Processing ${migrationFiles.length} schema migrations...`,
    );
    for (const file of migrationFiles) {
      if (appliedVersions.has(file)) {
        console.log(`  -> Skipping already applied migration: ${file}`);
        continue;
      }

      // If database was previously initialized before schema_migrations table was added:
      if (initialSchemaExists && appliedVersions.size === 0) {
        console.log(`  -> Marking pre-existing migration as recorded: ${file}`);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
          [file],
        );
        continue;
      }

      console.log(`  -> Running migration ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (version) VALUES ($1)",
        [file],
      );
    }

    // 2. Ensure application and auth roles exist and have proper permissions
    console.log("[deploy-init-db] Verifying database roles (redmesh_app, redmesh_auth)...");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'redmesh_app') THEN
          CREATE ROLE redmesh_app LOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'redmesh_auth') THEN
          CREATE ROLE redmesh_auth LOGIN;
        END IF;
      END
      $$;
    `);

    await client.query(`
      GRANT CONNECT ON DATABASE redmesh TO redmesh_app, redmesh_auth;
      GRANT USAGE ON SCHEMA public TO redmesh_app, redmesh_auth;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO redmesh_app;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO redmesh_app;
      REVOKE ALL ON ALL TABLES IN SCHEMA public FROM redmesh_auth;
      REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM redmesh_auth;
      REVOKE INSERT, UPDATE, DELETE ON audit_events FROM redmesh_app;
      GRANT EXECUTE ON FUNCTION app_authenticate_user(TEXT) TO redmesh_auth;
      GRANT EXECUTE ON FUNCTION app_find_session_by_refresh_token(TEXT) TO redmesh_auth;
    `);

    if (appPassword) {
      console.log("[deploy-init-db] Setting redmesh_app password...");
      await client.query(
        `ALTER ROLE redmesh_app WITH PASSWORD '${appPassword.replace(/'/g, "''")}';`,
      );
    }
    if (authPassword) {
      console.log("[deploy-init-db] Setting redmesh_auth password...");
      await client.query(
        `ALTER ROLE redmesh_auth WITH PASSWORD '${authPassword.replace(/'/g, "''")}';`,
      );
    }

    // 3. Seed demo baseline data (001_demo_data.sql)
    console.log(
      "[deploy-init-db] Seeding base entities (roles, units, users, assets)...",
    );
    const seed1Path = path.join(rootDir, "database/seeds/001_demo_data.sql");
    const seed1Sql = fs.readFileSync(seed1Path, "utf-8");
    await client.query(seed1Sql);

    // 4. Hash demo password with Argon2id and set for evaluation personas
    console.log(
      "[deploy-init-db] Setting Argon2id password hashes for evaluation personas...",
    );
    const passwordHash = await argon2.hash(demoPassword, {
      type: argon2.argon2id,
    });
    await client.query(
      "UPDATE users SET password_hash = $1 WHERE username IN ('rahul', 'alex', 'john')",
      [passwordHash],
    );

    // Ensure admin user exists with password hash and ADMIN role
    await client.query(
      `
      INSERT INTO users (id, username, display_name, clearance, unit_id, password_hash)
      VALUES ('20000000-0000-0000-0000-000000000009', 'admin', 'Admin', 'TOP_SECRET', '10000000-0000-0000-0000-000000000001', $1)
      ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;
    `,
      [passwordHash],
    );

    await client.query(`
      INSERT INTO user_roles (user_id, role_id)
      VALUES ('20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000005')
      ON CONFLICT DO NOTHING;
    `);

    // 5. Seed clean workflow state (002_clean_workflow_data.sql)
    console.log(
      "[deploy-init-db] Applying clean evaluation workflow baseline...",
    );
    const seed2Path = path.join(
      rootDir,
      "database/seeds/002_clean_workflow_data.sql",
    );
    const seed2Sql = fs.readFileSync(seed2Path, "utf-8");
    await client.query(seed2Sql);

    console.log(
      "[deploy-init-db] Database initialization completed successfully.",
    );
  } finally {
    await client.end();
  }

  // 6. Verify audit integrity
  console.log(
    "[deploy-init-db] Verifying cryptographic audit chain integrity...",
  );
  const adminId = "20000000-0000-0000-0000-000000000009";
  const verification = await verifyAuditChain(adminId);
  console.log(
    "[deploy-init-db] Audit chain status:",
    JSON.stringify(verification, null, 2),
  );
  await appPool.end();

  if (!verification.valid) {
    throw new Error(
      `Audit chain verification failed: ${verification.reason}`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  deployInitDb().catch((err) => {
    console.error("[deploy-init-db] Error:", err);
    process.exit(1);
  });
}
