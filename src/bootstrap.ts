import { loadSecretsFromVault } from "./config/secrets.js";
import { validateAppEnv, validateVaultEnv } from "./config/env.js";

async function bootstrap(): Promise<void> {
    if (process.env.VAULT_ENABLED === "true") {
        validateVaultEnv();
        const secrets = await loadSecretsFromVault();

        process.env.DATABASE_URL = secrets.databaseUrl;
        process.env.DATABASE_BOOTSTRAP_URL = secrets.databaseBootstrapUrl;
        process.env.PASETO_SECRET_KEY = secrets.pasetoSecretKey;
        process.env.PASETO_PUBLIC_KEY = secrets.pasetoPublicKey;
    }

    validateAppEnv();
    await import("./index.js");
}

bootstrap().catch((error) => {
    console.error(
        "REDmesh startup failed:",
        error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
});