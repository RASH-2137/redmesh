CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- REDmesh Initial Schema
-- ============================================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL
);

CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    clearance TEXT NOT NULL
        CHECK (clearance IN ('CONFIDENTIAL', 'SECRET', 'TOP_SECRET')),
    unit_id UUID NOT NULL REFERENCES units(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    classification TEXT NOT NULL
        CHECK (classification IN ('CONFIDENTIAL', 'SECRET', 'TOP_SECRET')),
    unit_id UUID NOT NULL REFERENCES units(id),
    status TEXT NOT NULL DEFAULT 'AVAILABLE'
        CHECK (
            status IN (
                'AVAILABLE',
                'PROVISIONED',
                'MAINTENANCE',
                'REVOKED'
            )
        ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id),
    asset_id UUID NOT NULL REFERENCES assets(id),
    action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'CANCELLED'
            )
        ),
    reason TEXT,
    decided_by UUID REFERENCES users(id),
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provisioning_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_request_id UUID NOT NULL REFERENCES access_requests(id),
    asset_id UUID NOT NULL REFERENCES assets(id),
    user_id UUID NOT NULL REFERENCES users(id),
    status TEXT NOT NULL
        CHECK (status IN ('PROVISIONED', 'REVOKED')),
    provisioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    result TEXT NOT NULL,
    reason TEXT,
    request_id TEXT,
    trace_id TEXT,
    previous_hash TEXT,
    current_hash TEXT,
    schema_version INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_users_unit_id
    ON users(unit_id);

CREATE INDEX idx_user_roles_role_id
    ON user_roles(role_id);

CREATE INDEX idx_assets_unit_id
    ON assets(unit_id);

CREATE INDEX idx_assets_classification
    ON assets(classification);

CREATE INDEX idx_access_requests_requester_id
    ON access_requests(requester_id);

CREATE INDEX idx_access_requests_asset_id
    ON access_requests(asset_id);

CREATE INDEX idx_access_requests_status
    ON access_requests(status);

CREATE INDEX idx_provisioning_records_user_id
    ON provisioning_records(user_id);

CREATE INDEX idx_provisioning_records_asset_id
    ON provisioning_records(asset_id);

CREATE INDEX idx_sessions_user_id
    ON sessions(user_id);

CREATE INDEX idx_audit_events_occurred_at
    ON audit_events(occurred_at);

CREATE INDEX idx_audit_events_actor_user_id
    ON audit_events(actor_user_id);

CREATE INDEX idx_audit_events_resource_id
    ON audit_events(resource_id);