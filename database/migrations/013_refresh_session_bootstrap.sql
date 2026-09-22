BEGIN;

CREATE OR REPLACE FUNCTION app_find_session_by_refresh_token(
    p_refresh_token_hash TEXT
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    family_id UUID,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.user_id,
        s.family_id,
        s.expires_at,
        s.revoked_at
    FROM sessions AS s
    WHERE s.refresh_token_hash = p_refresh_token_hash
    LIMIT 1
    FOR UPDATE;
END;
$$;

REVOKE ALL
ON FUNCTION app_find_session_by_refresh_token(TEXT)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION app_find_session_by_refresh_token(TEXT)
TO redmesh_app;

COMMIT;