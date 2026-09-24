CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE IF NOT EXISTS audit_event_chain_position_seq
    AS BIGINT
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE audit_events
    ADD COLUMN IF NOT EXISTS chain_position BIGINT;

-- Do not silently convert an existing audit history into a new
-- hash-chain format. This migration is intended to establish the
-- chain before audit events are written.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM audit_events) THEN
        RAISE EXCEPTION
            'audit_events already contains rows; audit chain migration requires explicit history migration';
    END IF;
END;
$$;

ALTER TABLE audit_events
    ALTER COLUMN chain_position
    SET DEFAULT nextval('audit_event_chain_position_seq');

ALTER TABLE audit_events
    ALTER COLUMN chain_position
    SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
    audit_events_chain_position_unique
ON audit_events(chain_position);

-- Audit events are append-only from the application role.
REVOKE INSERT, UPDATE, DELETE
ON audit_events
FROM redmesh_app;


CREATE OR REPLACE FUNCTION app_append_audit_event(
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id UUID,
    p_result TEXT,
    p_reason TEXT DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL,
    p_trace_id TEXT DEFAULT NULL
)
RETURNS audit_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_user_id UUID;
    v_previous_hash TEXT;
    v_chain_position BIGINT;
    v_occurred_at TIMESTAMPTZ;
    v_current_hash TEXT;
    v_event audit_events;
    v_canonical TEXT;
BEGIN
    /*
     * Serialize all audit writers so that concurrent requests
     * cannot observe the same previous chain head.
     */
    PERFORM pg_advisory_xact_lock(735921846201);

    /*
     * The API sets app.user_id only after authenticating the
     * request with a PASETO access token.
     */
    v_actor_user_id :=
        NULLIF(
            current_setting('app.user_id', true),
            ''
        )::UUID;

    /*
     * The previous event is the current chain head.
     * The first event has no predecessor.
     */
    SELECT ae.current_hash
    INTO v_previous_hash
    FROM audit_events AS ae
    ORDER BY ae.chain_position DESC
    LIMIT 1;

    v_chain_position :=
        nextval('audit_event_chain_position_seq');

    v_occurred_at := clock_timestamp();

    /*
     * Canonical representation:
     *
     * Each value is encoded as:
     *     <byte-length>:<value>
     *
     * NULL is represented as:
     *     -1:
     *
     * This prevents delimiter ambiguity when user-controlled
     * values contain characters such as "|" or ":".
     */
    v_canonical :=
        'schema_version=' ||
            length('1') || ':1' ||
        '|chain_position=' ||
            length(v_chain_position::TEXT) || ':' ||
            v_chain_position::TEXT ||
        '|occurred_at=' ||
            length(
                to_char(
                    v_occurred_at AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                )
            ) || ':' ||
            to_char(
                v_occurred_at AT TIME ZONE 'UTC',
                'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ) ||
        '|actor_user_id=' ||
            CASE
                WHEN v_actor_user_id IS NULL THEN '-1:'
                ELSE
                    length(v_actor_user_id::TEXT)::TEXT ||
                    ':' ||
                    v_actor_user_id::TEXT
            END ||
        '|action=' ||
            CASE
                WHEN p_action IS NULL THEN '-1:'
                ELSE
                    length(p_action)::TEXT ||
                    ':' ||
                    p_action
            END ||
        '|resource_type=' ||
            CASE
                WHEN p_resource_type IS NULL THEN '-1:'
                ELSE
                    length(p_resource_type)::TEXT ||
                    ':' ||
                    p_resource_type
            END ||
        '|resource_id=' ||
            CASE
                WHEN p_resource_id IS NULL THEN '-1:'
                ELSE
                    length(p_resource_id::TEXT)::TEXT ||
                    ':' ||
                    p_resource_id::TEXT
            END ||
        '|result=' ||
            CASE
                WHEN p_result IS NULL THEN '-1:'
                ELSE
                    length(p_result)::TEXT ||
                    ':' ||
                    p_result
            END ||
        '|reason=' ||
            CASE
                WHEN p_reason IS NULL THEN '-1:'
                ELSE
                    length(p_reason)::TEXT ||
                    ':' ||
                    p_reason
            END ||
        '|request_id=' ||
            CASE
                WHEN p_request_id IS NULL THEN '-1:'
                ELSE
                    length(p_request_id)::TEXT ||
                    ':' ||
                    p_request_id
            END ||
        '|trace_id=' ||
            CASE
                WHEN p_trace_id IS NULL THEN '-1:'
                ELSE
                    length(p_trace_id)::TEXT ||
                    ':' ||
                    p_trace_id
            END ||
        '|previous_hash=' ||
            CASE
                WHEN v_previous_hash IS NULL THEN '-1:'
                ELSE
                    length(v_previous_hash)::TEXT ||
                    ':' ||
                    v_previous_hash
            END;

    v_current_hash :=
        encode(
            extensions.digest(
                convert_to(v_canonical, 'UTF8'),
                'sha256'
            ),
            'hex'
        );

    INSERT INTO audit_events (
        occurred_at,
        actor_user_id,
        action,
        resource_type,
        resource_id,
        result,
        reason,
        request_id,
        trace_id,
        previous_hash,
        current_hash,
        schema_version,
        chain_position
    )
    VALUES (
        v_occurred_at,
        v_actor_user_id,
        p_action,
        p_resource_type,
        p_resource_id,
        p_result,
        p_reason,
        p_request_id,
        p_trace_id,
        v_previous_hash,
        v_current_hash,
        1,
        v_chain_position
    )
    RETURNING *
    INTO v_event;

    RETURN v_event;
END;
$$;


REVOKE ALL
ON FUNCTION app_append_audit_event(
    TEXT,
    TEXT,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    TEXT
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION app_append_audit_event(
    TEXT,
    TEXT,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    TEXT
)
TO redmesh_app;