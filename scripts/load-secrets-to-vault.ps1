$ErrorActionPreference = "Stop"

$envPath = Join-Path $PSScriptRoot "..\.env"

if (-not (Test-Path $envPath)) {
    throw ".env file not found"
}

$values = @{}

Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()

    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line -split "=", 2

        if ($parts.Count -eq 2) {
            $values[$parts[0]] = $parts[1]
        }
    }
}

$required = @(
    "DATABASE_URL",
    "DATABASE_BOOTSTRAP_URL",
    "PASETO_SECRET_KEY",
    "PASETO_PUBLIC_KEY"
)

foreach ($name in $required) {
    if (-not $values.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($values[$name])) {
        throw "Missing required secret: $name"
    }
}

$vaultToken = if (-not [string]::IsNullOrWhiteSpace($env:VAULT_TOKEN)) {
    $env:VAULT_TOKEN
} else {
    $values["VAULT_TOKEN"]
}

docker exec `
    -e VAULT_ADDR=http://127.0.0.1:8200 `
    -e VAULT_TOKEN=$vaultToken `
    redmesh-vault `
    vault kv put secret/redmesh/application `
    database_url="$($values["DATABASE_URL"])" `
    database_bootstrap_url="$($values["DATABASE_BOOTSTRAP_URL"])" `
    paseto_secret_key="$($values["PASETO_SECRET_KEY"])" `
    paseto_public_key="$($values["PASETO_PUBLIC_KEY"])"

if ($LASTEXITCODE -ne 0) {
    throw "Vault secret upload failed"
}

Write-Host "REDmesh application secrets loaded into Vault."