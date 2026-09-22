# API Specification & Endpoint Reference: Sovereign SecureMesh (REDmesh)

This document provides technical documentation for all HTTP REST endpoints implemented in the REDmesh platform.

---

## 1. Global Conventions & Standards

* **Base URL:** `http://127.0.0.1:3000` (configurable via `HOST` and `PORT` environment variables)
* **Content Negotiation:** All request and response bodies use `application/json` (UTF-8).
* **Authentication Header:** Protected endpoints require the standard Bearer scheme:
  ```http
  Authorization: Bearer <paseto-v4-token>
  ```
* **Security Headers & Redaction:** Sensitive headers (`authorization`, `cookie`) and body properties (`password`, `accessToken`, `refreshToken`) are automatically stripped from server logs.

---

## 2. Health & System Status Endpoints

### 2.1 Basic Health Check
* **Method:** `GET`
* **Path:** `/health`
* **Purpose:** Basic liveness probe to verify HTTP listener availability.
* **Authentication:** None.
* **Authorization:** Unrestricted.
* **Request Parameters / Body:** None.
* **Response Behavior:**
  * `200 OK`:
    ```json
    {
      "status": "ok",
      "service": "REDmesh",
      "environment": "development"
    }
    ```
* **Relevant Security Boundary:** Boundary 1 (Client $\rightarrow$ API).

---

### 2.2 Database Connectivity Check
* **Method:** `GET`
* **Path:** `/health/db`
* **Purpose:** Deep readiness probe verifying active PostgreSQL connection pool availability.
* **Authentication:** None.
* **Authorization:** Unrestricted.
* **Request Parameters / Body:** None.
* **Response Behavior:**
  * `200 OK`:
    ```json
    {
      "status": "ok",
      "database": "connected"
    }
    ```
  * `500 Internal Server Error`: Database unreachable or connection pool exhausted.
* **Relevant Security Boundary:** Boundary 4 (API $\rightarrow$ PostgreSQL).

---

## 3. Authentication & Session Endpoints

### 3.1 Authenticate User (Login)
* **Method:** `POST`
* **Path:** `/auth/login`
* **Purpose:** Authenticates username and password credentials, creates a new session family, and issues a PASETO v4 access token and refresh token.
* **Authentication:** None.
* **Authorization:** Unrestricted.
* **Request Body:**
  ```json
  {
    "username": "<username-string>",
    "password": "<plaintext-password>"
  }
  ```
* **Response Behavior:**
  * `200 OK`: Successful authentication.
    ```json
    {
      "accessToken": "v4.public.<base64url-payload-and-signature>",
      "refreshToken": "<cryptographically-random-token>",
      "expiresIn": 300
    }
    ```
  * `400 Bad Request`: Missing or empty `username` or `password`.
  * `401 Unauthorized`: Invalid username or password (computed via constant-time verification to prevent user enumeration).
* **Relevant Security Boundary:** Boundary 2 (API $\rightarrow$ Authentication) & Boundary 4 (`redmesh_auth` bootstrap role executing `app_authenticate_user`).

---

### 3.2 Refresh Credentials
* **Method:** `POST`
* **Path:** `/auth/refresh`
* **Purpose:** Rotates an existing refresh token, issuing a new access token and new refresh token. Detects token reuse to terminate hijacked session families.
* **Authentication:** None (refresh token provided in body).
* **Authorization:** Unrestricted.
* **Request Body:**
  ```json
  {
    "refreshToken": "<current-refresh-token>"
  }
  ```
* **Response Behavior:**
  * `200 OK`: Credentials successfully rotated.
    ```json
    {
      "accessToken": "v4.public.<new-paseto-token>",
      "refreshToken": "<new-refresh-token>",
      "expiresIn": 300
    }
    ```
  * `400 Bad Request`: Missing `refreshToken`.
  * `401 Unauthorized`: Token expired, unknown, or previously revoked (reuse detection automatically revokes entire session family).
* **Relevant Security Boundary:** Boundary 2 & Boundary 4 (`sessions` family management).

---

### 3.3 Terminate Session (Logout)
* **Method:** `POST`
* **Path:** `/auth/logout`
* **Purpose:** Explicitly revokes the active session associated with the bearer token.
* **Authentication:** Required (`Bearer <paseto-v4-token>`).
* **Authorization:** Caller owns the session (`user_id` matches session owner).
* **Request Parameters / Body:** None.
* **Response Behavior:**
  * `204 No Content`: Session successfully revoked or already inactive.
  * `401 Unauthorized`: Missing or invalid Bearer token.
* **Relevant Security Boundary:** Boundary 2 (Token verification) & Boundary 4 (Session revocation).

---

### 3.4 Get Current User Identity
* **Method:** `GET`
* **Path:** `/auth/me`
* **Purpose:** Retrieves identity, clearance level, unit assignment, and active roles for the authenticated user.
* **Authentication:** Required (`Bearer <paseto-v4-token>`).
* **Authorization:** Session must be active in the database.
* **Request Parameters / Body:** None.
* **Response Behavior:**
  * `200 OK`:
    ```json
    {
      "user": {
        "id": "20000000-0000-0000-0000-000000000001",
        "username": "rahul",
        "displayName": "Rahul",
        "clearance": "SECRET",
        "unitId": "10000000-0000-0000-0000-000000000001",
        "unitCode": "AIR-17",
        "isActive": true,
        "roles": ["MECHANIC"]
      }
    }
    ```
  * `401 Unauthorized`: Token invalid, expired, or session revoked.
* **Relevant Security Boundary:** Boundary 2 (Token verification) & Boundary 4 (`users` table RLS policy `users_self_select`).

---

## 4. Asset & Provisioning Endpoints

### 4.1 Inspect Asset
* **Method:** `GET`
* **Path:** `/assets/:id`
* **Purpose:** Retrieves operational details for a defense asset.
* **Authentication:** Required (`Bearer <paseto-v4-token>`).
* **Authorization:** 
  * Cerbos action: `asset:view` (User clearance $\ge$ asset classification, unit match).
  * PostgreSQL RLS: User unit must match asset unit (`unit_id = app_current_user_unit_id()`).
* **Path Parameters:**
  * `id` (UUID): Asset identifier.
* **Response Behavior:**
  * `200 OK`:
    ```json
    {
      "asset": {
        "id": "30000000-0000-0000-0000-000000000001",
        "name": "Aircraft Engine",
        "classification": "SECRET",
        "unitId": "10000000-0000-0000-0000-000000000001",
        "status": "AVAILABLE"
      }
    }
    ```
  * `403 Forbidden`: Clearance level insufficient for classification.
  * `404 Not Found`: Asset does not exist OR asset belongs to another unit (RLS isolation).
* **Relevant Security Boundary:** Boundary 3 (Cerbos ABAC) & Boundary 4 (PostgreSQL RLS `assets_same_unit_select`).

---

### 4.1b List Unit Resources
* **Method:** `GET`
* **Path:** `/assets`
* **Purpose:** Retrieves all defense assets located within the authenticated caller's unit, enriched with Cerbos view and request eligibility indicators.
* **Authentication:** Required (`Bearer <paseto-v4-token>`).
* **Authorization:** Scoped by PostgreSQL RLS (`unit_id = app_current_user_unit_id()`).
* **Request Parameters / Body:** None.
* **Response Behavior:**
  * `200 OK`:
    ```json
    {
      "assets": [
        {
          "id": "30000000-0000-0000-0000-000000000001",
          "name": "Aircraft Engine",
          "classification": "SECRET",
          "unitId": "10000000-0000-0000-0000-000000000001",
          "status": "AVAILABLE",
          "canView": true,
          "canRequest": true
        }
      ]
    }
    ```
  * `401 Unauthorized`: Missing or invalid Bearer token.
* **Relevant Security Boundary:** Boundary 4 (PostgreSQL RLS `assets_same_unit_select`) & Boundary 3 (Cerbos ABAC).

---

### 4.2 Submit Access Request
* **Method:** `POST`
* **Path:** `/assets/:id/requests`
* **Purpose:** Submits a request to provision an asset for maintenance or operational deployment.
* **Authentication:** Required (`Bearer <paseto-v4-token>`).
* **Authorization:** Cerbos action `asset:request` (Role permitted, clearance sufficient, unit match).
* **Path Parameters:**
  * `id` (UUID): Asset identifier.
* **Request Body:**
  ```json
  {
    "reason": "Scheduled quarterly maintenance"
  }
  ```
* **Response Behavior:**
  * `201 Created`:
    ```json
    {
      "request": {
        "id": "<request-uuid>",
        "requesterId": "<user-uuid>",
        "assetId": "<asset-uuid>",
        "action": "asset:request",
        "status": "PENDING",
        "reason": "Scheduled quarterly maintenance",
        "decidedBy": null,
        "decidedAt": null,
        "createdAt": "2026-09-18T16:00:00.000Z"
      }
    }
    ```
  * `403 Forbidden`: Cerbos policy denies request.
  * `404 Not Found`: Target asset not found or belongs to another unit.
* **Relevant Security Boundary:** Boundary 3 (Cerbos), Boundary 4 (RLS insert), and Boundary 4 (Audit event `access_request.created`).

---

### 4.3 Approve Access Request
* **Method:** `POST`
* **Path:** `/access-requests/:id/approve`
* **Purpose:** Commander approves a pending access request within their unit.
* **Authentication:** Required (`Bearer <paseto-v4-token>`).
* **Authorization:** Cerbos action `asset:approve` (`COMMANDER` role only, clearance sufficient).
* **Path Parameters:**
  * `id` (UUID): Access request identifier.
* **Response Behavior:**
  * `200 OK`: Status updated to `APPROVED`.
  * `403 Forbidden`: Caller lacks `COMMANDER` role or sufficient clearance.
  * `404 Not Found`: Access request does not exist or target asset outside commander's unit.
  * `409 Conflict`: Request is not in `PENDING` status (already decided).
* **Relevant Security Boundary:** Boundary 3 (Cerbos) & Boundary 4 (Audit event `access_request.approved`).

---

### 4.4 Reject Access Request
* **Method:** `POST`
* **Path:** `/access-requests/:id/reject`
* **Purpose:** Commander rejects a pending access request.
* **Authentication:** Required (`Bearer <paseto-v4-token>`).
* **Authorization:** Cerbos action `asset:reject` (`COMMANDER` role only, clearance sufficient).
* **Path Parameters:**
  * `id` (UUID): Access request identifier.
* **Response Behavior:**
  * `200 OK`: Status updated to `REJECTED`.
  * `403 Forbidden`: Caller lacks `COMMANDER` role or sufficient clearance.
  * `404 Not Found`: Access request does not exist.
  * `409 Conflict`: Request is not in `PENDING` status.
* **Relevant Security Boundary:** Boundary 3 (Cerbos) & Boundary 4 (Audit event `access_request.rejected`).

---

### 4.4b List Access Requests
* **Method:** `GET`
* **Path:** `/access-requests`
* **Purpose:** Retrieves access requests visible to the caller under PostgreSQL Row-Level Security (Mechanics see their own requests; Commanders see all requests for assets within their unit).
* **Authentication:** Required (`Bearer <paseto-v4-token>`).
* **Authorization:** Scoped by PostgreSQL RLS (`access_requests_requester_select` and `access_requests_commander_select`).
* **Request Parameters / Body:** None.
* **Response Behavior:**
  * `200 OK`:
    ```json
    {
      "requests": [
        {
          "id": "<request-uuid>",
          "requesterId": "<user-uuid>",
          "assetId": "<asset-uuid>",
          "assetName": "Aircraft Engine",
          "assetClassification": "SECRET",
          "action": "asset:request",
          "status": "PENDING",
          "reason": "Scheduled maintenance",
          "decidedBy": null,
          "decidedAt": null,
          "createdAt": "2026-09-18T16:00:00.000Z"
        }
      ]
    }
    ```
  * `401 Unauthorized`: Missing or invalid Bearer token.
* **Relevant Security Boundary:** Boundary 4 (PostgreSQL RLS `access_requests` policies).

---

### 4.5 Provision Asset
* **Method:** `POST`
* **Path:** `/access-requests/:id/provision`
* **Purpose:** Creates an active provisioning record for an approved request.
* **Authentication:** Required (`Bearer <paseto-v4-token>`).
* **Authorization:** Cerbos action `asset:provision` (`COMMANDER` role only).
* **Path Parameters:**
  * `id` (UUID): Access request identifier.
* **Response Behavior:**
  * `201 Created`:
    ```json
    {
      "provisioning": {
        "id": "<provisioning-uuid>",
        "accessRequestId": "<request-uuid>",
        "assetId": "<asset-uuid>",
        "userId": "<requester-user-uuid>",
        "status": "PROVISIONED",
        "provisionedAt": "2026-09-18T16:05:00.000Z",
        "revokedAt": null
      }
    }
    ```
  * `403 Forbidden`: Caller lacks provisioning authority.
  * `404 Not Found`: Access request not found.
  * `409 Conflict`: Request is not `APPROVED`, or request was already provisioned (enforced by unique index `provisioning_records_access_request_unique`).
* **Relevant Security Boundary:** Boundary 3 (Cerbos), Boundary 4 (Unique constraint check), and Boundary 4 (Audit event `provisioning.created`).

---

### 4.6 Revoke Provisioning
* **Method:** `POST`
* **Path:** `/provisioning/:id/revoke`
* **Purpose:** Revokes an active provisioning assignment.
* **Authentication:** Required (`Bearer <paseto-v4-token>`).
* **Authorization:** Cerbos action `asset:revoke` (`COMMANDER` role only).
* **Path Parameters:**
  * `id` (UUID): Provisioning record identifier.
* **Response Behavior:**
  * `200 OK`: Status updated to `REVOKED`.
  * `403 Forbidden`: Caller lacks revocation authority.
  * `404 Not Found`: Provisioning record not found.
  * `409 Conflict`: Provisioning record already revoked.
* **Relevant Security Boundary:** Boundary 3 (Cerbos) & Boundary 4 (Audit event `provisioning.revoked`).

---

### 4.6b List Provisioning Records
* **Method:** `GET`
* **Path:** `/provisioning`
* **Purpose:** Retrieves provisioning records visible to the caller under PostgreSQL Row-Level Security (Individual users see records assigned to them; Commanders see all provisioning records for assets within their unit).
* **Authentication:** Required (`Bearer <paseto-v4-token>`).
* **Authorization:** Scoped by PostgreSQL RLS (`provisioning_records_user_select` and `provisioning_records_commander_select`).
* **Request Parameters / Body:** None.
* **Response Behavior:**
  * `200 OK`:
    ```json
    {
      "provisioning": [
        {
          "id": "<provisioning-uuid>",
          "accessRequestId": "<request-uuid>",
          "assetId": "<asset-uuid>",
          "assetName": "Aircraft Engine",
          "assetClassification": "SECRET",
          "userId": "<user-uuid>",
          "status": "PROVISIONED",
          "provisionedAt": "2026-09-18T16:05:00.000Z",
          "revokedAt": null
        }
      ]
    }
    ```
  * `401 Unauthorized`: Missing or invalid Bearer token.
* **Relevant Security Boundary:** Boundary 4 (PostgreSQL RLS `provisioning_records` policies).

---

## 5. Audit & Forensic Integrity Endpoints

### 5.1 Verify Audit Chain Integrity
* **Method:** `GET`
* **Path:** `/audit/integrity`
* **Purpose:** Cryptographically verifies the entire sequential hash chain in the `audit_events` table, verifying schema versioning, hash consistency, and sequential pointers from genesis to head.
* **Authentication:** Required (`Bearer <paseto-v4-token>`).
* **Authorization:** Restricted to users holding the `AUDITOR` or `ADMIN` role.
* **Request Parameters / Body:** None.
* **Response Behavior:**
  * `200 OK` (Valid Chain):
    ```json
    {
      "verification": {
        "valid": true,
        "eventCount": 42,
        "firstInvalidPosition": null,
        "reason": null
      }
    }
    ```
  * `200 OK` (Tampered Chain Detected):
    ```json
    {
      "verification": {
        "valid": false,
        "eventCount": 42,
        "firstInvalidPosition": 17,
        "reason": "Current hash mismatch at position 17"
      }
    }
    ```
  * `401 Unauthorized`: Missing or invalid Bearer token.
  * `403 Forbidden`: Caller lacks `AUDITOR` or `ADMIN` role.
* **Relevant Security Boundary:** Boundary 2 (Token verification), Boundary 4 (RLS policy `audit_events_auditor_select`), and Boundary 4 (Audit chain cryptographic verification engine).

---

### 5.2 List Audit Events
* **Method:** `GET`
* **Path:** `/audit/events`
* **Purpose:** Retrieves sequential chronological audit ledger entries for forensic review.
* **Authentication:** Required (`Bearer <paseto-v4-token>`).
* **Authorization:** Restricted to users holding the `AUDITOR` or `ADMIN` role.
* **Request Parameters / Body:** None.
* **Response Behavior:**
  * `200 OK`:
    ```json
    {
      "events": [
        {
          "id": "<event-uuid>",
          "occurredAt": "2026-09-18T16:00:00.000000Z",
          "actorUserId": "<user-uuid>",
          "action": "access_request.created",
          "resourceType": "access_request",
          "resourceId": "<resource-uuid>",
          "result": "SUCCESS",
          "reason": null,
          "requestId": null,
          "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
          "previousHash": null,
          "currentHash": "7d4ce537b5105b647117f60b0d4982428d1eadb8e7d199bde6c95caa29336fb4",
          "schemaVersion": 1,
          "chainPosition": 1
        }
      ]
    }
    ```
  * `401 Unauthorized`: Missing or invalid Bearer token.
  * `403 Forbidden`: Caller lacks `AUDITOR` or `ADMIN` role.
* **Relevant Security Boundary:** Boundary 2 & Boundary 4 (PostgreSQL RLS `audit_events_auditor_select`).
