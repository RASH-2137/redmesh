-- ============================================================
-- REDmesh workflow authorization RLS
-- ============================================================

-- Helper: determine whether the authenticated user has a role.
CREATE OR REPLACE FUNCTION app_has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r
            ON r.id = ur.role_id
        WHERE ur.user_id = app_current_user_id()
          AND r.name = required_role
    );
$$;

REVOKE ALL ON FUNCTION app_has_role(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_has_role(TEXT) TO redmesh_app;


-- ------------------------------------------------------------
-- COMMANDER ACCESS TO REQUESTS
-- ------------------------------------------------------------

CREATE POLICY access_requests_commander_select
ON access_requests
FOR SELECT
TO redmesh_app
USING (
    app_has_role('COMMANDER')
    AND asset_id IN (
        SELECT a.id
        FROM public.assets a
        WHERE a.unit_id = app_current_user_unit_id()
    )
);

CREATE POLICY access_requests_commander_update
ON access_requests
FOR UPDATE
TO redmesh_app
USING (
    app_has_role('COMMANDER')
    AND asset_id IN (
        SELECT a.id
        FROM public.assets a
        WHERE a.unit_id = app_current_user_unit_id()
    )
)
WITH CHECK (
    app_has_role('COMMANDER')
    AND asset_id IN (
        SELECT a.id
        FROM public.assets a
        WHERE a.unit_id = app_current_user_unit_id()
    )
);


-- ------------------------------------------------------------
-- PROVISIONING RECORDS
-- ------------------------------------------------------------

CREATE POLICY provisioning_records_commander_select
ON provisioning_records
FOR SELECT
TO redmesh_app
USING (
    app_has_role('COMMANDER')
    AND asset_id IN (
        SELECT a.id
        FROM public.assets a
        WHERE a.unit_id = app_current_user_unit_id()
    )
);

CREATE POLICY provisioning_records_commander_insert
ON provisioning_records
FOR INSERT
TO redmesh_app
WITH CHECK (
    app_has_role('COMMANDER')
    AND asset_id IN (
        SELECT a.id
        FROM public.assets a
        WHERE a.unit_id = app_current_user_unit_id()
    )
);

CREATE POLICY provisioning_records_commander_update
ON provisioning_records
FOR UPDATE
TO redmesh_app
USING (
    app_has_role('COMMANDER')
    AND asset_id IN (
        SELECT a.id
        FROM public.assets a
        WHERE a.unit_id = app_current_user_unit_id()
    )
)
WITH CHECK (
    app_has_role('COMMANDER')
    AND asset_id IN (
        SELECT a.id
        FROM public.assets a
        WHERE a.unit_id = app_current_user_unit_id()
    )
);