interface VaultResponse {
    data?: {
        data?: Record<string, unknown>;
    };
}

export interface RedmeshSecrets {
    databaseUrl: string;
    databaseBootstrapUrl: string;
    pasetoSecretKey: string;
    pasetoPublicKey: string;
}

function requireSecret(
    value: unknown,
    name: string,
): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Vault secret "${name}" is missing`);
    }

    return value;
}

export async function loadSecretsFromVault(): Promise<RedmeshSecrets> {
    const address = process.env.VAULT_ADDR;

    if (!address) {
        throw new Error("VAULT_ADDR is not configured");
    }

    const token = process.env.VAULT_TOKEN;

    if (!token) {
        throw new Error("VAULT_TOKEN is not configured");
    }

    const path =
        process.env.VAULT_SECRET_PATH ??
        "secret/data/redmesh/application";

    const response = await fetch(
        `${address.replace(/\/$/, "")}/v1/${path}`,
        {
            headers: {
                "X-Vault-Token": token,
            },
        },
    );

    if (!response.ok) {
        throw new Error(
            `Vault secret loading failed with status ${response.status}`,
        );
    }

    const body = (await response.json()) as VaultResponse;
    const data = body.data?.data;

    if (!data) {
        throw new Error("Vault returned no secret data");
    }

    return {
        databaseUrl: requireSecret(
            data.database_url,
            "database_url",
        ),
        databaseBootstrapUrl: requireSecret(
            data.database_bootstrap_url,
            "database_bootstrap_url",
        ),
        pasetoSecretKey: requireSecret(
            data.paseto_secret_key,
            "paseto_secret_key",
        ),
        pasetoPublicKey: requireSecret(
            data.paseto_public_key,
            "paseto_public_key",
        ),
    };
}