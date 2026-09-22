# Sovereign SecureMesh (REDmesh) — Deployment Guide

This guide provides comprehensive instructions for deploying REDmesh in both **Local Development** and **Single-Host Production** environments (e.g., Oracle Cloud Infrastructure Compute / Ubuntu VM).

---

## 1. Architecture Overview

### Production Topology (`docker-compose.prod.yml`)

In production, all core application services are isolated within an internal bridge network (`redmesh-internal`). Only the Caddy reverse proxy exposes public ports (`80` and `443`).

```mermaid
flowchart TD
    Client(["Public Internet Client"])
    
    subgraph Host ["Single-Host Production Host (e.g. OCI VM)"]
        subgraph Edge ["Public Edge (Only Exposed Ports)"]
            Caddy["Caddy Reverse Proxy\n(Ports 80 & 443)\nAuto-TLS via Let's Encrypt"]
        end

        subgraph InternalNet ["Isolated Docker Network (redmesh-internal)"]
            Frontend["Next.js Standalone Frontend\n(Internal port 3000)"]
            Backend["Fastify API Backend\n(Internal port 3000)"]
            Cerbos["Cerbos Policy Decision Point\n(Internal port 3592)"]
            Postgres["PostgreSQL 17 Database\n(Internal port 5432)\nVolume: redmesh_postgres_data"]
        end
    end

    Client -->|HTTPS:443 / HTTP:80| Caddy
    Caddy -->|Reverse Proxy /api/backend/*| Backend
    Caddy -->|Reverse Proxy /*| Frontend
    Backend -->|Internal DB Connection Pool| Postgres
    Backend -->|ABAC Decision Queries (HTTP)| Cerbos
    Backend -.->|Optional Metrics (Internal:9464)| InternalNet
```

### Network & Port Allocation Table

| Service | Container Name | Internal Port | Host / Public Port | Access Level |
| :--- | :--- | :--- | :--- | :--- |
| **Caddy** | `redmesh-caddy` | 80, 443 | `80`, `443` | **Public (Ingress)** |
| **Next.js Frontend** | `redmesh-frontend` | 3000 | *None* | Internal network only |
| **Fastify Backend** | `redmesh-backend` | 3000 | *None* | Internal network only |
| **Cerbos PDP** | `redmesh-cerbos` | 3592 | *None* | Internal network only |
| **PostgreSQL** | `redmesh-postgres` | 5432 | *None* | Internal network only |
| **OTel Metrics** | Fastify runtime | 9464 | *None* | Internal network only |

---

## 2. Environment Configurations: Local Dev vs. Production

| Aspect | Local Development (`docker-compose.yml`) | Production (`docker-compose.prod.yml`) |
| :--- | :--- | :--- |
| **Target Orchestration** | `docker-compose.yml` (dependencies only) | `docker-compose.prod.yml` (all 5 services) |
| **Frontend/Backend** | Run on host via `npm run dev` / `tsx` | Multi-stage Docker containers with non-root users |
| **Reverse Proxy / TLS** | None (Direct localhost ports) | Caddy with automatic Let's Encrypt TLS |
| **Vault** | In-memory dev container (`VAULT_ENABLED=true`) | Disabled (`VAULT_ENABLED=false`); secrets injected via env |
| **Database Ports** | `127.0.0.1:5433 -> 5432` | Strictly internal (`5432` on `redmesh-internal` only) |
| **Cerbos Ports** | `127.0.0.1:3592 -> 3592` | Strictly internal (`3592` on `redmesh-internal` only) |
| **Health Checks** | Container health checks on Postgres | Native healthchecks on Postgres, Backend, Frontend |
| **User Privileges** | Root in dev containers | Dedicated non-root users (`redmesh` uid 10001, `nextjs` uid 1001) |

---

## 3. Required Production Environment Variables

In production, create a secure `.env` file on the deployment host. **Never commit this file to version control.**

```bash
# ==============================================================================
# REDmesh Production Environment Configuration
# ==============================================================================

# --- Domain & Ingress ---
# The public domain pointing to your host IP. Set to "localhost" for local testing.
DOMAIN=redmesh.yourdomain.com

# --- Node Runtime ---
NODE_ENV=production
LOG_LEVEL=info
PORT=3000
HOST=0.0.0.0

# --- PostgreSQL Configuration ---
POSTGRES_USER=redmesh
POSTGRES_DB=redmesh
POSTGRES_PASSWORD=<STRONG_RANDOM_ADMIN_PASSWORD>
REDMESH_APP_PASSWORD=<STRONG_RANDOM_APP_PASSWORD>
REDMESH_AUTH_PASSWORD=<STRONG_RANDOM_AUTH_PASSWORD>

# --- Application Database Connection URLs ---
# Internal Docker service name "postgres" on standard port 5432
DATABASE_URL=postgresql://redmesh_app:<REDMESH_APP_PASSWORD>@postgres:5432/redmesh
DATABASE_BOOTSTRAP_URL=postgresql://redmesh_auth:<REDMESH_AUTH_PASSWORD>@postgres:5432/redmesh

# --- Cerbos PDP ---
CERBOS_URL=http://cerbos:3592

# --- PASETO v4.public Asymmetric Cryptographic Keypair ---
PASETO_PUBLIC_KEY=k4.public.<BASE64_URL_SAFE_ED25519_PUBLIC_KEY>
PASETO_SECRET_KEY=k4.secret.<BASE64_URL_SAFE_ED25519_SECRET_KEY>

# --- Secrets Management ---
# In production, secrets are injected via environment variables
VAULT_ENABLED=false

# --- Observability ---
OTEL_SERVICE_NAME=redmesh-api
OTEL_METRICS_PORT=9464
```

---

## 4. Generating Production Secrets

Before deploying, generate fresh cryptographic keys and strong random passwords.

### 4.1 PASETO v4 Keypair Generation
Run the keypair generator script:
```bash
npm run generate-paseto-keys
```
This prints a new `k4.public` and `k4.secret` pair. Copy them directly into your deployment environment file.

### 4.2 Database Passwords
Generate high-entropy random passwords using OpenSSL or Python:
```bash
# Generate admin password
openssl rand -base64 32

# Generate application role password
openssl rand -base64 32

# Generate authentication bootstrap role password
openssl rand -base64 32
```

### 4.3 Demo Persona Password Hashes
To update demo user passwords with Argon2id hashes, use the provided script:
```bash
npx tsx src/scripts/hash-password.ts "YourSecurePassword"
```

---

## 5. Production Build Artifacts

The repository includes production-hardened build files:

1. **`Dockerfile.backend`**:
   - Multi-stage build using `node:20-alpine`.
   - Builder stage includes build tools (`python3`, `make`, `g++`) to compile native modules (`argon2`).
   - Production runner stage drops all build tools, prunes dev dependencies, sets `NODE_ENV=production`, creates an unprivileged `redmesh` user (UID/GID 10001), and implements a container health check.
2. **`frontend/Dockerfile`**:
   - Multi-stage build using `node:20-alpine`.
   - Uses Next.js standalone build output mode (`output: "standalone"` in `next.config.mjs`).
   - Runner image contains only minimal Node runtime and static assets.
   - Runs as unprivileged `nextjs` user (UID 1001) with a container healthcheck querying `/api/health` or `/`.
3. **`Caddyfile`**:
   - Lightweight, secure reverse proxy with automated Let's Encrypt TLS.
   - Proxies `/api/backend/*` to the Fastify backend service, stripping `/api/backend` prefix.
   - Proxies all other traffic to the Next.js frontend service.
   - Injects security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).
4. **`docker-compose.prod.yml`**:
   - Orchestrates all 5 containers on the private `redmesh-internal` network.
   - Persists database data in the `redmesh_postgres_data` named volume.
   - Implements dependency ordering (`depends_on` with `condition: service_healthy`).

---

## 6. Deployment Procedure (Step-by-Step)

### Step 1: Provision the Host VM
- Launch an Ubuntu 22.04 or 24.04 LTS instance (e.g. OCI Compute).
- Ensure Security Lists / Firewall rules allow incoming traffic on ports `80` (HTTP) and `443` (HTTPS). Block all other inbound ports.
- Install Docker Engine and Docker Compose V2:
  ```bash
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker $USER
  ```

### Step 2: Clone Repository & Create `.env`
- Clone the repository to the host.
- Create your production `.env` file following Section 3 with generated secrets.
- Set strict permissions:
  ```bash
  chmod 600 .env
  ```

### Step 3: Build Production Images
```bash
docker compose -f docker-compose.prod.yml build
```

### Step 4: Initialize the Database
Before launching all services, start PostgreSQL to run migrations:
```bash
docker compose -f docker-compose.prod.yml up -d postgres
```
Wait for PostgreSQL to become healthy:
```bash
docker compose -f docker-compose.prod.yml ps
```

Run the automated database deployment initializer. This script executes role creation, migrations `001` through `014`, clean workflow seeds, and verifies cryptographic audit chain integrity:
```bash
# Run deployment script using a one-off backend container
docker compose -f docker-compose.prod.yml run --rm backend npx tsx src/scripts/deploy-init-db.ts
```
Expected output confirmation:
```
[DeployInit] Audit chain integrity check: { valid: true, eventCount: 7 }
[DeployInit] Database initialization and verification complete.
```

### Step 5: Start the Full Platform
```bash
docker compose -f docker-compose.prod.yml up -d
```

Verify service status and health:
```bash
docker compose -f docker-compose.prod.yml ps
```
All services (`redmesh-postgres`, `redmesh-cerbos`, `redmesh-backend`, `redmesh-frontend`, `redmesh-caddy`) should report `healthy` or `running`.

---

## 7. Operational Runbook & Maintenance

### 7.1 Viewing Logs
```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# View backend logs only
docker compose -f docker-compose.prod.yml logs -f backend

# View reverse proxy logs
docker compose -f docker-compose.prod.yml logs -f caddy
```

### 7.2 Database Backups
Create an encrypted or compressed backup of the PostgreSQL database:
```bash
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U redmesh -d redmesh --clean --if-exists | gzip > redmesh_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 7.3 Restoring Database
```bash
gunzip -c redmesh_backup_YYYYMMDD_HHMMSS.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U redmesh -d redmesh
```

### 7.4 Verifying Audit Integrity On-Demand
Run the audit chain integrity verifier at any time against the running database:
```bash
docker compose -f docker-compose.prod.yml run --rm backend npx tsx -e "
  import { pool } from './src/config/database.js';
  import { verifyAuditChainIntegrity } from './src/modules/audit/verifier.js';
  verifyAuditChainIntegrity(pool).then(res => {
    console.log('Audit Integrity:', res);
    process.exit(res.valid ? 0 : 1);
  });
"
```

### 7.5 Updating Application Versions
```bash
git pull origin master
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```
