import Fastify, { FastifyInstance } from "fastify";
import { healthRoutes } from "../src/routes/health.js";
import { authRoutes } from "../src/routes/auth.js";
import { assetRoutes } from "../src/routes/assets.js";
import { provisioningRoutes } from "../src/routes/provisioning.js";
import { auditRoutes } from "../src/routes/audit.js";
import { loadSecretsFromVault } from "../src/config/secrets.js";

let vaultInitialized = false;

export async function buildTestApp(): Promise<FastifyInstance> {
    if (!vaultInitialized && process.env.VAULT_ENABLED === "true") {
        const secrets = await loadSecretsFromVault();
        process.env.DATABASE_URL = secrets.databaseUrl;
        process.env.DATABASE_BOOTSTRAP_URL = secrets.databaseBootstrapUrl;
        process.env.PASETO_SECRET_KEY = secrets.pasetoSecretKey;
        process.env.PASETO_PUBLIC_KEY = secrets.pasetoPublicKey;
        vaultInitialized = true;
    }

    const app = Fastify({
        logger: false, // disable logging for tests
    });

    await healthRoutes(app);
    await authRoutes(app);
    await assetRoutes(app);
    await provisioningRoutes(app);
    await auditRoutes(app);

    await app.ready();
    return app;
}
