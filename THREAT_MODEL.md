# Threat Model: Sovereign SecureMesh (REDmesh)

## 1. Scope & Objective

This threat model identifies the assets, threat actors, attack vectors, defensive controls, verification methods, and residual limitations inherent in the Sovereign SecureMesh (REDmesh) platform. It provides a structured analysis rather than generic security advice, grounded in the actual codebase and architecture.

---

## 2. Protected Assets

| Asset Category | Specific Assets | Confidentiality Impact | Integrity Impact | Availability Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Identity & Sessions** | User identities, password hashes, active sessions, refresh token hashes | High: Account takeover, impersonation. | High: Unauthorized identity alteration. | Med: Denial of authentication service. |
| **Bearer Credentials** | PASETO v4 access tokens, plaintext refresh tokens | High: Ephemeral impersonation within TTL. | High: Forged claims if keys compromised. | Low: Tokens expire rapidly. |
| **Defense Resources** | Classified assets (CONFIDENTIAL, SECRET, TOP_SECRET) | Critical: Exposure of classified material. | High: Unauthorized state or classification changes. | Med: Loss of asset operational status. |
| **Workflow State** | Access requests, provisioning records | Med: Visibility into operational intent. | High: Unauthorized resource assignment or false revocation. | High: Inability to provision critical assets. |
| **Audit Logs** | Hash-chained audit event records | Med: Reconnaissance of system operations. | Critical: Concealment of unauthorized actions. | High: Loss of compliance or forensic capacity. |
| **Secrets & Keys** | PASETO private/public keys, database credentials, Vault token | Critical: Total cryptographic compromise. | Critical: Forged identity tokens, DB takeover. | Critical: System-wide operational denial. |
| **Authorization Rules**| Cerbos policy files (`redmesh_assets.yaml`) | Low: Policy definitions are public schema. | Critical: Unauthorized privilege elevation. | High: Blanket denial of all access. |

---

## 3. Threat Actors & Capabilities

| Threat Actor | Motivation / Goal | Capabilities & Vectors |
| :--- | :--- | :--- |
| **Unauthenticated External Attacker** | Credential harvesting, system access, service denial. | Remote network access to Fastify HTTP endpoints; credential stuffing, brute force, token forgery, payload tampering. |
| **Authenticated Low-Privilege User** | Horizontal privilege escalation (IDOR/BOLA), vertical escalation to Commander/Admin. | Valid low-privilege account (`MECHANIC` or `CONTRACTOR`); API manipulation, parameter tampering, cross-unit probing. |
| **Compromised User Session** | Execute unauthorized workflows using stolen credentials. | Possession of leaked bearer token or refresh token; replay attacks, parallel session usage. |
| **Malicious Insider (Limited Privilege)**| Sabotage, unauthorized provisioning, espionage within unit. | Valid unit credentials with access to internal network; attempts to bypass dual-custody approval or tamper with logs. |
| **IDOR / BOLA Adversary** | Enumerate and manipulate resources belonging to foreign units. | Automated cycling of UUIDs across `/assets/:id` and provisioning routes. |
| **Authorization Bypass Adversary**| Execute actions above assigned clearance level. | Alteration of token claims or manipulating Cerbos query attributes. |
| **Audit Manipulation Adversary** | Erase or falsify audit evidence following an intrusion. | SQL injection, direct DB table manipulation, hash collision attacks. |

---

## 4. Trust Boundaries & Interaction Surface

```
[Threat Actor: External]
          |
    [Boundary 1: Client -> Fastify API]
          |
    [Fastify Application Layer]
     /          |                 \
[Boundary 2]  [Boundary 3]     [Boundary 4]
 PASETO Auth   Cerbos PDP       PostgreSQL RLS
     |          |                 |
     \          |                 /
    [Boundary 5: Vault]    [Boundary 6: OpenTelemetry]
```

1. **Boundary 1 (Client $\rightarrow$ API):** Network perimeter accepting JSON over HTTP. Subject to parsing vulnerabilities, brute force, and parameter injection.
2. **Boundary 2 (API $\rightarrow$ PASETO Identity Subsystem):** Validates cryptographic signatures on access tokens. Fails closed on signature mismatch or expiration.
3. **Boundary 3 (API $\rightarrow$ Cerbos Policy Engine):** Sends principal and resource attributes over local HTTP/gRPC. PDP decision determines action authorization.
4. **Boundary 4 (API $\rightarrow$ PostgreSQL 17):** Transaction-level database isolation. Enforces unit boundaries via `FORCE ROW LEVEL SECURITY`.
5. **Boundary 5 (Application $\rightarrow$ HashiCorp Vault):** Internal secrets retrieval channel. Delivers database credentials and cryptographic signing keys at startup.
6. **Boundary 6 (Application $\rightarrow$ Observability Stack):** Emits OpenTelemetry trace spans and Prometheus metrics. Out-of-band data channel.

---

## 5. Threat Analysis Matrix

### 5.1 Credential & Authentication Attacks

#### Threat: Credential Stuffing / Brute-Force Password Guessing
* **Attack:** Automated dictionary attacks against `POST /auth/login`.
* **Impact:** Compromise of valid user accounts.
* **Existing Control:** Passwords hashed with **Argon2id**. When invalid or non-existent usernames are targeted, `authenticate()` performs a dummy verification with `dummyPasswordHash`, ensuring constant-time response and preventing user enumeration.
* **Detection / Verification:** `tests/auth.test.ts` asserts invalid passwords and unknown usernames return `401 Unauthorized`.
* **Residual Limitation:** No IP-based rate limiting or account lockout mechanism is currently implemented in Fastify routes.

#### Threat: Token Signature Forgery / Algorithm Confusion
* **Attack:** Modifying token claims or manipulating cryptographic headers (e.g., `alg: none` or RSA-to-HMAC confusion).
* **Impact:** Forging access tokens with arbitrary user IDs or elevated clearance.
* **Existing Control:** Uses **PASETO v4.public** (Ed25519 asymmetric signatures). PASETO protocol specifies cipher suites by design and rejects header-specified algorithms. `verifyAccessToken()` strictly validates `purpose === 'access'`, `iss === 'redmesh-api'`, and `aud === 'redmesh'`.
* **Detection / Verification:** `tests/paseto.test.ts` asserts tampered tokens, altered payloads, and invalid purposes fail cryptographic verification.
* **Residual Limitation:** If the private key (`PASETO_SECRET_KEY`) is compromised from Vault, arbitrary valid tokens can be forged until key rotation.

#### Threat: Token Replay Past Expiration
* **Attack:** Intercepting an access token and replaying it after the legitimate session terminates.
* **Impact:** Continued unauthorized access.
* **Existing Control:** Short 5-minute access token TTL (`exp: '5 minutes'`). Every request also verifies session liveness via `getAuthenticatedUser()`, which queries `isSessionActive()`.
* **Detection / Verification:** `tests/paseto.test.ts` verifies expired tokens are rejected; `tests/session.test.ts` verifies logout immediately invalidates active sessions.
* **Residual Limitation:** During the 5-minute window before an explicit logout or revocation, an intercepted token is valid if the session record is still active in the database.

---

### 5.2 Session & Refresh Token Attacks

#### Threat: Refresh Token Theft & Reuse
* **Attack:** An adversary intercepts a refresh token and attempts to rotate credentials to gain persistent access.
* **Impact:** Long-term unauthorized account takeover.
* **Existing Control:** **Session Family Rotation & Automatic Reuse Detection**. When a refresh token is used, it is revoked and replaced with a new token in the same `family_id`. If an already-revoked refresh token is presented, the system detects replay and immediately revokes the **entire family**, killing both the legitimate user's and attacker's sessions. Refresh tokens are stored only as SHA-256 hashes in PostgreSQL.
* **Detection / Verification:** `tests/session.test.ts` ("Reusing old refresh token revokes entire session family") asserts that attempting reuse returns `401` and revokes subsequent access for that family.
* **Residual Limitation:** If an attacker uses the refresh token *before* the legitimate user attempts rotation, the attacker acquires a new valid pair; however, as soon as the legitimate user attempts their rotation, the fraud is detected and both sessions are terminated.

---

### 5.3 Authorization & Access Control Attacks

#### Threat: Insecure Direct Object References (IDOR / BOLA) Across Units
* **Attack:** An authenticated user in Unit A manipulates UUIDs in `/assets/:id` or `/assets/:id/requests` to target an asset in Unit B.
* **Impact:** Leakage of classified asset specifications or unauthorized request creation for another military unit.
* **Existing Control:** **PostgreSQL Row-Level Security (`FORCE ROW LEVEL SECURITY`)**. All queries execute within `withRlsContext(userId)` setting `app.user_id`. RLS policy `assets_same_unit_select` enforces `unit_id = app_current_user_unit_id()`. Foreign unit rows are invisible to the database engine and return `0` rows.
* **Detection / Verification:** `tests/assets.test.ts` ("Cross-unit access is denied by RLS (404)") verifies that an authenticated user in Unit CIV-04 querying an asset in AIR-17 receives `404 Not Found`.
* **Residual Limitation:** Relies on the application always wrapping database calls in `withRlsContext`. If a raw query executes on `appPool` without setting `app.user_id`, `app_current_user_id()` returns `NULL` and policies fail closed (returning 0 rows).

#### Threat: Clearance Level Bypass / Vertical Privilege Escalation
* **Attack:** A user with `SECRET` clearance attempts to view or request a `TOP_SECRET` asset within their own unit.
* **Impact:** Unauthorized intelligence disclosure.
* **Existing Control:** **Cerbos Policy Engine (ABAC)**. `authorizeAssetAction` checks the user's clearance against the asset's classification level. The policy requires `request.principal.attr.clearance_level >= request.resource.attr.classification_level`.
* **Detection / Verification:** `tests/assets.test.ts` ("Insufficient clearance access is denied by Cerbos (403)") verifies that a SECRET user querying a TOP_SECRET asset receives `403 Forbidden`.
* **Residual Limitation:** Clearance levels are mapped to integers in code (`CONFIDENTIAL: 1, SECRET: 2, TOP_SECRET: 3`). Any change in clearance taxonomy requires synchronization between database enums, TypeScript definitions, and Cerbos policy rules.

---

### 5.4 Workflow & Provisioning Abuse

#### Threat: Self-Approval of Access Requests (Dual-Custody Bypass)
* **Attack:** A `MECHANIC` requests access to an asset and immediately submits `POST /access-requests/:id/approve`.
* **Impact:** Unauthorized single-party access to operational equipment.
* **Existing Control:** Cerbos policy restricts `asset:approve` strictly to the `COMMANDER` role within the same unit.
* **Detection / Verification:** `tests/provisioning.test.ts` ("Mechanic cannot approve the request") verifies that approval attempts by mechanics return `403 Forbidden`.
* **Residual Limitation:** If a user possesses both `MECHANIC` and `COMMANDER` roles (role conflation), separation of duty is weakened unless an explicit requester $\neq$ approver constraint is enforced in application code.

#### Threat: Replay Provisioning / Duplicate Provisioning
* **Attack:** Attempting to execute `POST /access-requests/:id/provision` multiple times for the same approved request.
* **Impact:** Inconsistent operational inventory records or double-allocation.
* **Existing Control:** Database unique index `provisioning_records_access_request_unique` on `provisioning_records(access_request_id)`. The API handles unique constraint collisions and returns `409 Conflict`.
* **Detection / Verification:** `src/routes/provisioning.ts` catches unique violation errors; verified by database constraints.
* **Residual Limitation:** Concurrency races at the network boundary are resolved by the database unique constraint, which aborts the duplicate transaction.

---

### 5.5 Audit Log Tampering & Manipulation

#### Threat: Audit Record Modification or Deletion
* **Attack:** An attacker with application database access attempts to UPDATE or DELETE audit records to conceal illicit activity.
* **Impact:** Loss of forensic accountability and compliance failure.
* **Existing Control:**
  1. Database privileges: `REVOKE INSERT, UPDATE, DELETE ON audit_events FROM redmesh_app`.
  2. Append-only mechanism: Audits are inserted exclusively via `SECURITY DEFINER` function `app_append_audit_event()`.
  3. Cryptographic hash chain: Each event embeds `previous_hash` pointing to the prior event's SHA-256 hash.
* **Detection / Verification:** `tests/audit.test.ts` tests tamper detection by directly updating an audit row's `action` or `previous_hash` via an administrative connection. In both cases, `/audit/integrity` flags the chain as invalid and identifies the exact tampered position.
* **Residual Limitation:** The audit chain resides in the primary PostgreSQL database. A database superuser or physical storage attacker could rewrite the entire chain from a given position forward (recalculating all hashes). Off-site replication or write-once-read-many (WORM) storage is required to counter database superuser compromise.

#### Threat: Concurrent Audit Race Conditions & Chain Forking
* **Attack:** Concurrent HTTP requests attempt to append audit records simultaneously, causing race conditions in `previous_hash` selection.
* **Impact:** Broken audit chain linkage or deadlocks.
* **Existing Control:** `app_append_audit_event()` acquires a PostgreSQL transaction advisory lock (`pg_advisory_xact_lock(735921846201)`), strictly serializing audit writers until transaction commit.
* **Detection / Verification:** Enforced in migration `010_audit_chain.sql`.
* **Residual Limitation:** Transaction advisory locking serializes all audit operations, establishing an upper throughput bound on write transactions on a single database node.

---

### 5.6 Information Disclosure & Secrets Leakage

#### Threat: Secret Exposure in Application Logs
* **Attack:** Inspecting console logs or centralized log aggregators for authentication tokens, passwords, or secret keys.
* **Impact:** Session hijacking, credential compromise.
* **Existing Control:** Fastify Pino logger is configured with proactive redaction paths (`req.headers.authorization`, `headers.cookie`, `*.password`, `*.passwordHash`, `*.accessToken`, `*.refreshToken`, `*.paseto`). Fields matching these paths are stripped (`remove: true`) before output.
* **Detection / Verification:** Verified in `src/index.ts`.
* **Residual Limitation:** If unredacted sensitive values are logged under custom property names not in the redaction list, they may appear in logs.

#### Threat: Hardcoded Credentials in Source Control
* **Attack:** Compromising the Git repository to extract production database passwords or PASETO keys.
* **Impact:** Complete system breach.
* **Existing Control:** Centralized secret retrieval via **HashiCorp Vault**. `src/bootstrap.ts` pulls secrets dynamically into memory at startup. Git repositories contain only placeholders and environment documentation.
* **Detection / Verification:** Verified in `src/config/secrets.ts`.
* **Residual Limitation:** In development mode, Vault root token is passed via local `.env`. Production environments require IAM-based machine authentication (Vault AppRole or Kubernetes service accounts).
