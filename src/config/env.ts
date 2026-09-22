export function validateVaultEnv(): void {
    const addr = process.env.VAULT_ADDR;
    if (!addr || addr.trim().length === 0) {
        throw new Error(
            "Missing required environment variable for Vault: VAULT_ADDR",
        );
    }
    try {
        new URL(addr);
    } catch {
        throw new Error("Invalid VAULT_ADDR: must be a valid URL");
    }

    const token = process.env.VAULT_TOKEN;
    if (!token || token.trim().length === 0) {
        throw new Error(
            "Missing required environment variable for Vault: VAULT_TOKEN",
        );
    }
}

export function validateAppEnv(): void {
    // 1. DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl || dbUrl.trim().length === 0) {
        throw new Error("Missing required environment variable: DATABASE_URL");
    }
    if (!dbUrl.startsWith("postgres://") && !dbUrl.startsWith("postgresql://")) {
        throw new Error(
            "Invalid DATABASE_URL: must start with postgresql:// or postgres://",
        );
    }

    // 2. DATABASE_BOOTSTRAP_URL (optional, falls back to DATABASE_URL)
    const bootstrapUrl = process.env.DATABASE_BOOTSTRAP_URL;
    if (
        bootstrapUrl &&
        !bootstrapUrl.startsWith("postgres://") &&
        !bootstrapUrl.startsWith("postgresql://")
    ) {
        throw new Error(
            "Invalid DATABASE_BOOTSTRAP_URL: must start with postgresql:// or postgres://",
        );
    }

    // 3. PASETO_SECRET_KEY
    const pasetoSecret = process.env.PASETO_SECRET_KEY;
    if (!pasetoSecret || pasetoSecret.trim().length === 0) {
        throw new Error(
            "Missing required environment variable: PASETO_SECRET_KEY",
        );
    }
    if (!pasetoSecret.startsWith("k4.secret.")) {
        throw new Error(
            "Invalid PASETO_SECRET_KEY: must be a v4 public-key secret key starting with 'k4.secret.'",
        );
    }

    // 4. PASETO_PUBLIC_KEY
    const pasetoPublic = process.env.PASETO_PUBLIC_KEY;
    if (!pasetoPublic || pasetoPublic.trim().length === 0) {
        throw new Error(
            "Missing required environment variable: PASETO_PUBLIC_KEY",
        );
    }
    if (!pasetoPublic.startsWith("k4.public.")) {
        throw new Error(
            "Invalid PASETO_PUBLIC_KEY: must be a v4 public-key public key starting with 'k4.public.'",
        );
    }

    // 5. CERBOS_URL (optional with safe default)
    const cerbosUrl = process.env.CERBOS_URL;
    if (cerbosUrl) {
        try {
            new URL(cerbosUrl);
        } catch {
            throw new Error("Invalid CERBOS_URL: must be a valid URL");
        }
    }

    // 6. PORT
    const port = process.env.PORT;
    if (port !== undefined && port.trim().length > 0) {
        const portNum = Number(port);
        if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
            throw new Error(
                "Invalid PORT: must be an integer between 1 and 65535",
            );
        }
    }

    // 7. OTEL_METRICS_PORT
    const otelPort = process.env.OTEL_METRICS_PORT;
    if (otelPort !== undefined && otelPort.trim().length > 0) {
        const otelPortNum = Number(otelPort);
        if (!Number.isInteger(otelPortNum) || otelPortNum < 1 || otelPortNum > 65535) {
            throw new Error(
                "Invalid OTEL_METRICS_PORT: must be an integer between 1 and 65535",
            );
        }
    }

    // 8. NODE_ENV
    const nodeEnv = process.env.NODE_ENV;
    if (
        nodeEnv &&
        !["development", "test", "production"].includes(nodeEnv)
    ) {
        throw new Error(
            "Invalid NODE_ENV: must be 'development', 'test', or 'production'",
        );
    }

    // 9. LOG_LEVEL
    const logLevel = process.env.LOG_LEVEL;
    if (
        logLevel &&
        ![
            "fatal",
            "error",
            "warn",
            "info",
            "debug",
            "trace",
            "silent",
        ].includes(logLevel)
    ) {
        throw new Error(
            "Invalid LOG_LEVEL: must be one of fatal, error, warn, info, debug, trace, silent",
        );
    }

    // 10. VAULT_ENABLED
    const vaultEnabled = process.env.VAULT_ENABLED;
    if (
        vaultEnabled !== undefined &&
        vaultEnabled !== "true" &&
        vaultEnabled !== "false"
    ) {
        throw new Error("Invalid VAULT_ENABLED: must be 'true' or 'false'");
    }
}
