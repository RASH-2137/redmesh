-- ============================================================
-- REDmesh workflow RLS
-- ============================================================

-- ------------------------------------------------------------
-- ACCESS REQUESTS
-- ------------------------------------------------------------

CREATE POLICY access_requests_requester_select
ON access_requests
FOR SELECT
TO redmesh_app
USING (
    requester_id = app_current_user_id()
);

CREATE POLICY access_requests_requester_insert
ON access_requests
FOR INSERT
TO redmesh_app
WITH CHECK (
    requester_id = app_current_user_id()
);

-- A requester may cancel their own pending request.
CREATE POLICY access_requests_requester_update
ON access_requests
FOR UPDATE
TO redmesh_app
USING (
    requester_id = app_current_user_id()
)
WITH CHECK (
    requester_id = app_current_user_id()
);


-- ------------------------------------------------------------
-- PROVISIONING RECORDS
-- ------------------------------------------------------------

CREATE POLICY provisioning_records_user_select
ON provisioning_records
FOR SELECT
TO redmesh_app
USING (
    user_id = app_current_user_id()
);

CREATE POLICY provisioning_records_user_insert
ON provisioning_records
FOR INSERT
TO redmesh_app
WITH CHECK (
    user_id = app_current_user_id()
);