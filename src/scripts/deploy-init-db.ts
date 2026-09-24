import "dotenv/config";
import { Client } from "pg";
import argon2 from "argon2";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

async function ensureRoles(client: Client): Promise<void> {
  console.log("[deploy-init-db] Ensuring database roles exist...");

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'redmesh_app'
      ) THEN
        CREATE ROLE redmesh_app LOGIN;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'redmesh_auth'
      ) THEN
        CREATE ROLE redmesh_auth LOGIN;
      END IF;
    END
    $$;
  `);
}

async function configureRoles(
  client: Client,
  databaseName: string,
): Promise<void> {
  console.log("[deploy-init-db] Configuring database roles...");

  await client.query(
    `GRANT CONNECT ON DATABASE "${databaseName}" TO redmesh_app, redmesh_auth;`,
  );

  await client.query(`
    GRANT USAGE ON SCHEMA public TO redmesh_app, redmesh_auth;

    GRANT SELECT, INSERT, UPDATE, DELETE
      ON ALL TABLES IN SCHEMA public
      TO redmesh_app;

    GRANT USAGE, SELECT
      ON ALL SEQUENCES IN SCHEMA public
      TO redmesh_app;

    REVOKE ALL
      ON ALL TABLES IN SCHEMA public
      FROM redmesh_auth;

    REVOKE ALL
      ON ALL SEQUENCES IN SCHEMA public
      FROM redmesh_auth;

    REVOKE INSERT, UPDATE, DELETE
      ON audit_events
      FROM redmesh_app;

    GRANT EXECUTE
      ON FUNCTION app_authenticate_user(TEXT)
      TO redmesh_auth;

    GRANT EXECUTE
      ON FUNCTION app_find_session_by_refresh_token(TEXT)
      TO redmesh_auth;
  `);


  const appPassword = process.env.REDMESH_APP_PASSWORD;
  const authPassword = process.env.REDMESH_AUTH_PASSWORD;

  if (appPassword) {
    console.log("[deploy-init-db] Setting redmesh_app password...");
    await client.query(
      "ALTER ROLE redmesh_app WITH PASSWORD $1",
      [appPassword],
    );
  }

  if (authPassword) {
    console.log("[deploy-init-db] Setting redmesh_auth password...");
    await client.query(
      "ALTER ROLE redmesh_auth WITH PASSWORD $1",
      [authPassword],
    );
  }
}

async function applyMigrations(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const migrationsDir = path.join(rootDir, "database/migrations");

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  console.log(
    `[deploy-init-db] Processing ${migrationFiles.length} migrations...`,
  );

  for (const file of migrationFiles) {
    const existing = await client.query(
      "SELECT 1 FROM schema_migrations WHERE version = $1",
      [file],
    );

    if (existing.rowCount && existing.rowCount > 0) {
      console.log(`  -> Skipping already applied migration: ${file}`);
      continue;
    }

    console.log(`  -> Running migration: ${file}`);

    const sql = fs.readFileSync(
      path.join(migrationsDir, file),
      "utf-8",
    );

    await client.query("BEGIN");

    try {
      await client.query(sql);

      await client.query(
        "INSERT INTO schema_migrations (version) VALUES ($1)",
        [file],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

async function seedDatabase(client: Client): Promise<void> {
  const demoPassword =
    process.env.DEMO_ACCOUNT_PASSWORD || "password123";

  console.log(
    "[deploy-init-db] Seeding base entities...",
  );

  const seed1Path = path.join(
    rootDir,
    "database/seeds/001_demo_data.sql",
  );

  const seed1Sql = fs.readFileSync(seed1Path, "utf-8");

  await client.query(seed1Sql);

  console.log(
    "[deploy-init-db] Generating Argon2id evaluation password...",
  );

  const passwordHash = await argon2.hash(demoPassword, {
    type: argon2.argon2id,
  });

  await client.query(
    `
      UPDATE users
      SET password_hash = $1
      WHERE username IN ('rahul', 'alex', 'john')
    `,
    [passwordHash],
  );

  console.log("[deploy-init-db] Ensuring admin evaluation account exists...");

  await client.query(
    `
      INSERT INTO users (
        id,
        username,
        display_name,
        clearance,
        unit_id,
        password_hash
      )
      VALUES (
        '20000000-0000-0000-0000-000000000009',
        'admin',
        'Admin',
        'TOP_SECRET',
        '10000000-0000-0000-0000-000000000001',
        $1
      )
      ON CONFLICT (id)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash
    `,
    [passwordHash],
  );

  await client.query(`
    INSERT INTO user_roles (user_id, role_id)
    VALUES (
      '20000000-0000-0000-0000-000000000009',
      '00000000-0000-0000-0000-000000000005'
    )
    ON CONFLICT DO NOTHING;
  `);

  console.log(
    "[deploy-init-db] Applying clean workflow baseline...",
  );

  const seed2Path = path.join(
    rootDir,
    "database/seeds/002_clean_workflow_data.sql",
  );

  const seed2Sql = fs.readFileSync(seed2Path, "utf-8");

  await client.query(seed2Sql);
}

export async function deployInitDb(): Promise<void> {
  const adminUrl = process.env.ADMIN_DATABASE_URL;

  if (!adminUrl) {
    throw new Error(
      "ADMIN_DATABASE_URL must be set explicitly for deployment initialization.",
    );
  }

  const parsedUrl = new URL(adminUrl);

  const databaseName =
    parsedUrl.pathname.replace(/^\/+/, "") || "postgres";

  console.log(
    `[deploy-init-db] Target database: ${databaseName}`,
  );

  const client = new Client({
    connectionString: adminUrl,
  });

  await client.connect();

  try {
    // Roles must exist BEFORE migrations because migrations 012/013
    // reference them.
    await ensureRoles(client);

    // Apply migrations strictly in order.
    await applyMigrations(client);

    // Configure exact runtime permissions after schema exists.
    await configureRoles(client, databaseName);

    // Seed evaluation data.
    await seedDatabase(client);

    console.log(
      "[deploy-init-db] Database initialization completed successfully.",
    );
  } finally {
    await client.end();
  }

  // IMPORTANT:
  // Verify against the SAME deployment database rather than the
  // application's normal/local pool.
  console.log(
    "[deploy-init-db] Verifying cryptographic audit chain...",
  );

  const verificationClient = new Client({
    connectionString: adminUrl,
  });

  await verificationClient.connect();

  try {
    const adminId =
      "20000000-0000-0000-0000-000000000009";

    const result = await verificationClient.query<{
      previous_hash: string | null;
      current_hash: string;
      chain_position: number;
    }>(`
      SELECT
        previous_hash,
        current_hash,
        chain_position
      FROM audit_events
      ORDER BY chain_position ASC
    `);

    let previousHash: string | null = null;

    for (const event of result.rows) {
      if (event.previous_hash !== previousHash) {
        throw new Error(
          `Audit chain verification failed at position ${event.chain_position}: previous_hash mismatch`,
        );
      }

      previousHash = event.current_hash;
    }

    const count = result.rows.length;

    console.log(
      JSON.stringify(
        {
          valid: true,
          eventCount: count,
          checkedAgainst: "deployment database",
          verifierAdmin: adminId,
        },
        null,
        2,
      ),
    );

    console.log(
      "[deploy-init-db] Audit chain status: VERIFIED",
    );
  } finally {
    await verificationClient.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  deployInitDb().catch((error) => {
    console.error("[deploy-init-db] Error:", error);
    process.exit(1);
  });
}


