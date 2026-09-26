-- REDmesh
-- Authentication identity RLS policies
--
-- users and user_roles are FORCE RLS protected.
-- roles is a reference table and intentionally does not use RLS.

BEGIN;

-- The roles table intentionally does not use RLS.
-- Remove the temporary/manual policy if it exists.
DROP POLICY IF EXISTS roles_read_select
ON public.roles;

-- Users may read only their own identity row.
DROP POLICY IF EXISTS users_owner_select
ON public.users;

CREATE POLICY users_owner_select
ON public.users
FOR SELECT
TO redmesh_app
USING (
    id = app_current_user_id()
);

-- Users may read only their own role assignments.
DROP POLICY IF EXISTS user_roles_owner_select
ON public.user_roles;

CREATE POLICY user_roles_owner_select
ON public.user_roles
FOR SELECT
TO redmesh_app
USING (
    user_id = app_current_user_id()
);

COMMIT;