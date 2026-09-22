CREATE POLICY audit_events_auditor_select
ON audit_events
FOR SELECT
TO redmesh_app
USING (
    app_has_role('AUDITOR')
    OR app_has_role('ADMIN')
);