BEGIN;

-- ============================================================
-- Authentication bootstrap
--
-- Login happens before app.user_id exists, so the application
-- needs a narrowly scoped function to retrieve the password
-- verification material for one username.
--
-- This function does NOT expose arbitrary table access.
-- ============================================================

CREATE OR REPLACE FUNCTION app_authenticate_user(
    p_username TEXT
)
RETURNS TABLE (
    id UUID,
    password_hash TEXT,
    is_active BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        u.id,
        u.password_hash,
        u.is_active
    FROM users AS u
    WHERE u.username = p_username
    LIMIT 1;
$$;

REVOKE ALL
ON FUNCTION app_authenticate_user(TEXT)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION app_authenticate_user(TEXT)
TO redmesh_app;


-- ============================================================
-- Session RLS
-- ============================================================

DROP POLICY IF EXISTS sessions_owner_select
ON sessions;

CREATE POLICY sessions_owner_select
ON sessions
FOR SELECT
TO redmesh_app
USING (
    user_id = app_current_user_id()
);


DROP POLICY IF EXISTS sessions_owner_insert
ON sessions;

CREATE POLICY sessions_owner_insert
ON sessions
FOR INSERT
TO redmesh_app
WITH CHECK (
    user_id = app_current_user_id()
);


DROP POLICY IF EXISTS sessions_owner_update
ON sessions;

CREATE POLICY sessions_owner_update
ON sessions
FOR UPDATE
TO redmesh_app
USING (
    user_id = app_current_user_id()
)
WITH CHECK (
    user_id = app_current_user_id()
);


COMMIT;