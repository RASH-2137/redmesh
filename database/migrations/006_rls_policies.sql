-- ============================================================
-- REDmesh RLS policies
-- ============================================================

-- Return the authenticated user's unit without recursively
-- invoking the users table RLS policy.
--
-- SECURITY DEFINER is deliberately restricted:
--   - fixed search_path
--   - no dynamic SQL
--   - only returns the unit_id for app.user_id
CREATE OR REPLACE FUNCTION app_current_user_unit_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT u.unit_id
    FROM public.users AS u
    WHERE u.id = app_current_user_id()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION app_current_user_unit_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_current_user_unit_id() TO redmesh_app;


-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------

CREATE POLICY users_self_select
ON users
FOR SELECT
TO redmesh_app
USING (
    id = app_current_user_id()
);


-- ------------------------------------------------------------
-- USER ROLES
-- ------------------------------------------------------------

CREATE POLICY user_roles_self_select
ON user_roles
FOR SELECT
TO redmesh_app
USING (
    user_id = app_current_user_id()
);


-- ------------------------------------------------------------
-- ASSETS
-- ------------------------------------------------------------

CREATE POLICY assets_same_unit_select
ON assets
FOR SELECT
TO redmesh_app
USING (
    unit_id = app_current_user_unit_id()
);