# Security Architecture & Policies: Sovereign SecureMesh (REDmesh)

## 1. Security Philosophy

Sovereign SecureMesh (REDmesh) is designed around a single foundational premise: **never trust, always verify, and assume partial failure at every layer**. 

Security cannot depend on a single gateway, a client-side check, or trust between application services. REDmesh adopts a **defense-in-depth model** where each layer enforces its own security invariants, fails closed by default, and operates under least privilege.

---

## 2. Core Architectural Principles

### 2.1 Layered Defense (Defense in Depth)
Security controls are decoupled across distinct tiers. If an attacker bypasses one tier, subsequent tiers maintain containment:

```
[Layer 1: Network / Transport]  ──> Strict HTTP methods, Bearer token extraction
[Layer 2: Identity / AuthN]     ──> PASETO v4 Asymmetric Signature + Session Family Check
[Layer 3: Policy Engine / PDP]  ──> Cerbos ABAC (Role & Clearance vs. Classification)
[Layer 4: Storage Engine / PEP] ──> PostgreSQL FORCE ROW LEVEL SECURITY (Unit Isolation)
[Layer 5: Forensic Ledger]      ──> Tamper-Evident Cryptographic Hash Chain
[Layer 6: Secrets & Ops]        ──> Vault Runtime Secrets + OpenTelemetry Tracing
```

### 2.2 Least Privilege
* **Application DB Role (`redmesh_app`):** Lacks `SUPERUSER` or table ownership. Granted only necessary `SELECT`, `INSERT`, `UPDATE` permissions. Specifically denied direct `INSERT`, `UPDATE`, or `DELETE` on the `audit_events` table.
* **Authentication DB Role (`redmesh_auth`):** Restricted entirely to executing two stored procedures (`app_authenticate_user` and `app_find_session_by_refresh_token`). Has zero access to business tables (`assets`, `access_requests`, `provisioning_records`).
* **Session Scope:** Access tokens are scoped to 5-minute lifetimes and restricted to `purpose: 'access'`.

### 2.3 Complementary Security Boundaries
A critical architectural property of REDmesh is the clear separation between **authorization** and **data isolation**:

* **Cerbos is NOT a replacement for database isolation.** Cerbos decides whether an action should be allowed based on attributes (e.g., clearance level and operational role). It does not filter or partition rows in the database.
* **PostgreSQL RLS is NOT a replacement for application authorization.** RLS prevents users from seeing or modifying rows outside their organizational unit. It does not model complex business workflow rules or dual-custody clearance checks.
* **Complementary Interaction:** Even if a bug occurred in a Cerbos policy, RLS would physically block queries from returning records belonging to other units (failing closed with `404 Not Found`). Conversely, if an RLS policy were misconfigured, Cerbos would still block unauthorized operations (failing closed with `403 Forbidden`).

---

## 3. Implemented Security Controls

### 3.1 Authentication & Password Security
* **Argon2id Password Hashing:** User passwords are hashed using Argon2id (memory-hard, resistant to GPU/ASIC attacks).
* **Timing-Attack Countermeasures:** In `authenticate()`, when an unknown username or inactive user is supplied, the system computes an Argon2id verification against a pre-generated `dummyPasswordHash`. This ensures consistent execution duration regardless of user existence.

### 3.2 Token & Session Architecture
* **PASETO v4.public Tokens:** Eliminates vulnerabilities common to JSON Web Tokens (JWT), including algorithm switching (`alg: none`), symmetric/asymmetric key confusion, and header tampering. Signed with Ed25519 asymmetric keys.
* **Token Claims Validation:** Every token must present valid `sub` (User UUID), `sid` (Session UUID), `iss: 'redmesh-api'`, `aud: 'redmesh'`, and `purpose: 'access'`. Tokens with different purposes (e.g., refresh or reset) are rejected.
* **Session Family Invalidation (Reuse Detection):** Refresh tokens are single-use. When a refresh token is presented, the system rotates both the access token and refresh token. If an already-used refresh token is presented again, the system recognizes a token theft attempt and immediately revokes the **entire session family** (`WHERE family_id = $1`), terminating all sessions for that lineage.

### 3.3 Database Row-Level Security (RLS)
* **Forced RLS:** All primary entity tables (`users`, `user_roles`, `assets`, `access_requests`, `provisioning_records`, `sessions`, `audit_events`) have Row-Level Security enabled and enforced with `FORCE ROW LEVEL SECURITY`.
* **Transaction-Local User Context:** Application queries execute within `withRlsContext(userId)`, executing:
  ```sql
  SELECT set_config('app.user_id', $1, true);
  ```
  The third parameter (`is_local = true`) guarantees the variable is scoped strictly to the current transaction. If a connection is returned to the pool, the setting is cleared on `COMMIT` or `ROLLBACK`.
* **Fail-Closed Default:** The helper function `app_current_user_id()` catches invalid UUID representations and returns `NULL`. When `app.user_id` is unset or invalid, RLS policies evaluate to false, resulting in zero rows returned.

### 3.4 Tamper-Evident Cryptographic Audit Chain
* **Terminology:** REDmesh utilizes a **tamper-evident cryptographic audit chain**, not an "immutable blockchain".
* **Mechanism:** Every significant action (`access_request.created`, `access_request.approved`, `provisioning.created`, etc.) generates an audit row containing:
  * Sequence position (`chain_position`)
  * Accurate UTC timestamp (`occurred_at`)
  * Actor ID, action name, resource type, resource ID, request ID, trace ID
  * Previous event's current hash (`previous_hash`)
  * SHA-256 digest of the canonical byte-prefixed representation (`current_hash`)
* **Append-Only Protection:** Application database roles cannot write directly to `audit_events`. Writes must pass through `app_append_audit_event()`, which holds a PostgreSQL transaction advisory lock (`pg_advisory_xact_lock`) to serialize chain position assignment and hash calculation.
* **Cryptographic Verification:** Auditors can invoke `/audit/integrity` to traverse the chain from genesis to head, recalculating each canonical hash and verifying previous-hash pointers. Any modified row immediately causes verification to fail and pinpoints the corrupted position.

### 3.5 Secrets Management (HashiCorp Vault)
* Runtime secrets (`DATABASE_URL`, `DATABASE_BOOTSTRAP_URL`, `PASETO_SECRET_KEY`, `PASETO_PUBLIC_KEY`) are fetched at startup from HashiCorp Vault KV v2 store.
* Secrets are held in application memory and are never persisted to disk or emitted into log streams.

### 3.6 Structured Log Redaction & Observability
* **Automated Redaction:** The Fastify Pino logger is configured with proactive redaction paths (`req.headers.authorization`, `headers.cookie`, `*.password`, `*.passwordHash`, `*.accessToken`, `*.refreshToken`, `*.paseto`). Matching keys are permanently removed (`remove: true`).
* **Trace Context Propagation:** OpenTelemetry extracts W3C trace headers, associates structural `traceId` and `spanId` with the request, and injects the `traceId` into database audit events.

---

## 4. Security Verification & Automated Testing

REDmesh maintains a strict automated test suite providing regression coverage across all implemented boundaries.

### Phase 10 Test Suite Summary
There are currently **28 automated security-boundary tests** passing:

| Test Suite | Subtest Focus | Verification Objective |
| :--- | :--- | :--- |
| **Authentication Security** | 4 subtests | Valid credentials issue tokens; invalid passwords and unknown usernames return 401; missing/malformed bearer headers fail closed. |
| **PASETO Security** | 4 subtests | Valid tokens verify cleanly; tampered signatures fail; tokens with invalid purpose are rejected; expired tokens fail. |
| **Session Security** | 4 subtests | Login creates session records; refresh cleanly rotates token pairs; refresh token reuse revokes entire session family; logout terminates session. |
| **Assets Security** | 3 subtests | Authorized user can access resource; clearance deficiency triggers Cerbos 403; cross-unit access triggers RLS 404. |
| **Provisioning Security** | 4 subtests | Mechanic can request access; Mechanic cannot self-approve (403); Commander can approve (200); Mechanic cannot provision (403). |
| **Audit Security** | 3 subtests | Legitimate events verify as valid chain; tampered action content fails verification; tampered previous hash fails verification. |

> [!NOTE]
> **Statement on Test Coverage:** 28 automated security-boundary tests currently pass, providing regression coverage for the implemented authentication, authorization, database-isolation, session, provisioning, and audit-integrity controls. They verify that the implemented controls function according to specification.

---

## 5. Security Considerations & Limitations

1. **Vault Development Mode:** Local development uses Vault in `-dev` mode (in-memory storage without TLS). Production deployments must configure a durable storage backend (Consul, Raft), auto-unseal mechanisms, TLS termination, and short-lived AppRole tokens.
2. **Advisory Lock Throughput:** Audit events serialize writes via PostgreSQL advisory locks (`pg_advisory_xact_lock`). This prevents race conditions and chain forking within a single PostgreSQL database, but caps peak audit append throughput to single-node sequential write speeds.
3. **Database Superuser Trust:** An adversary who achieves PostgreSQL `SUPERUSER` privileges can alter audit records and recalculate hashes. In high-assurance environments, audit hashes should be continuously mirrored to off-site append-only storage or hardware security modules (HSM).
4. **Denial-of-Service (DoS) Protections:** Fastify routes currently lack application-level rate limiting (e.g., token bucket algorithms). Edge infrastructure (reverse proxy or API gateway) must provide rate limiting and WAF capabilities.

---

## 6. Vulnerability Disclosure Guidance

If you discover a potential security vulnerability in Sovereign SecureMesh:
1. Do **not** open a public issue on GitHub.
2. Submit a detailed report including steps to reproduce, impact assessment, and proof-of-concept payload to the repository maintainers.
3. Allow reasonable time for remediation prior to public disclosure.
