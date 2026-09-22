-- ============================================================
-- REDmesh Clean Evaluation Seed Data
-- 1 Pending request, 1 Approved request, 1 Provisioned record
-- Valid cryptographic audit chain matching seeded records
-- ============================================================

BEGIN;

-- 1. Clean test-generated records
TRUNCATE TABLE sessions CASCADE;
DELETE FROM provisioning_records;
DELETE FROM access_requests;
TRUNCATE TABLE audit_events RESTART IDENTITY;
ALTER SEQUENCE audit_event_chain_position_seq RESTART WITH 1;

-- 2. Ensure realistic assets in Unit AIR-17
INSERT INTO assets (id, asset_code, name, asset_type, classification, unit_id, status)
VALUES
    ('30000000-0000-0000-0000-000000000001', 'ENG-4721', 'Aircraft Engine', 'ENGINE', 'SECRET', '10000000-0000-0000-0000-000000000001', 'AVAILABLE'),
    ('30000000-0000-0000-0000-000000000002', 'RAD-8812', 'Radar Module', 'RADAR', 'TOP_SECRET', '10000000-0000-0000-0000-000000000001', 'AVAILABLE'),
    ('30000000-0000-0000-0000-000000000003', 'COM-2931', 'Communications Module', 'COMMUNICATION', 'CONFIDENTIAL', '10000000-0000-0000-0000-000000000001', 'AVAILABLE'),
    ('30000000-0000-0000-0000-000000000004', 'APU-9041', 'Auxiliary Power Unit', 'POWER_UNIT', 'SECRET', '10000000-0000-0000-0000-000000000001', 'PROVISIONED')
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    name = EXCLUDED.name,
    classification = EXCLUDED.classification;

-- 3. Seed Access Request 1: PROVISIONED (Historical workflow completed)
INSERT INTO access_requests (
    id,
    requester_id,
    asset_id,
    action,
    status,
    reason,
    decided_by,
    decided_at,
    created_at
)
VALUES (
    '40000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001', -- Rahul (Mechanic)
    '30000000-0000-0000-0000-000000000004', -- Auxiliary Power Unit
    'asset:request',
    'APPROVED',
    'Pre-flight electrical system check and power unit service',
    '20000000-0000-0000-0000-000000000002', -- Alex (Commander)
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '5 hours'
);

-- Seed Provisioning Record 1: Active Assignment
INSERT INTO provisioning_records (
    id,
    access_request_id,
    asset_id,
    user_id,
    status,
    provisioned_at,
    revoked_at
)
VALUES (
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001', -- Rahul
    'PROVISIONED',
    NOW() - INTERVAL '4 hours',
    NULL
);

-- 4. Seed Access Request 2: APPROVED (Ready for Commander to test Provisioning)
INSERT INTO access_requests (
    id,
    requester_id,
    asset_id,
    action,
    status,
    reason,
    decided_by,
    decided_at,
    created_at
)
VALUES (
    '40000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001', -- Rahul
    '30000000-0000-0000-0000-000000000003', -- Communications Module
    'asset:request',
    'APPROVED',
    'Avionics communications subsystem maintenance',
    '20000000-0000-0000-0000-000000000002', -- Alex
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '2 hours'
);

-- 5. Seed Access Request 3: PENDING (Ready for Commander to test Approval/Rejection)
INSERT INTO access_requests (
    id,
    requester_id,
    asset_id,
    action,
    status,
    reason,
    decided_by,
    decided_at,
    created_at
)
VALUES (
    '40000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001', -- Rahul
    '30000000-0000-0000-0000-000000000001', -- Aircraft Engine
    'asset:request',
    'PENDING',
    'Scheduled turbine inspection and diagnostic calibration',
    NULL,
    NULL,
    NOW() - INTERVAL '30 minutes'
);

-- 6. Generate valid cryptographic audit chain for seeded state
SELECT set_config('app.user_id', '20000000-0000-0000-0000-000000000009', true); -- Admin
SELECT app_append_audit_event('system.initialized', 'system', '10000000-0000-0000-0000-000000000001', 'SUCCESS', 'Unit AIR-17 evaluation baseline established');

SELECT set_config('app.user_id', '20000000-0000-0000-0000-000000000001', true); -- Rahul
SELECT app_append_audit_event('access_request.created', 'access_request', '40000000-0000-0000-0000-000000000001', 'SUCCESS', 'Pre-flight electrical system check and power unit service');

SELECT set_config('app.user_id', '20000000-0000-0000-0000-000000000002', true); -- Alex
SELECT app_append_audit_event('access_request.approved', 'access_request', '40000000-0000-0000-0000-000000000001', 'SUCCESS', 'Reviewer approval by Unit Commander');
SELECT app_append_audit_event('provisioning.created', 'provisioning', '50000000-0000-0000-0000-000000000001', 'SUCCESS', 'Resource assigned to Rahul (Mechanic)');

SELECT set_config('app.user_id', '20000000-0000-0000-0000-000000000001', true); -- Rahul
SELECT app_append_audit_event('access_request.created', 'access_request', '40000000-0000-0000-0000-000000000002', 'SUCCESS', 'Avionics communications subsystem maintenance');

SELECT set_config('app.user_id', '20000000-0000-0000-0000-000000000002', true); -- Alex
SELECT app_append_audit_event('access_request.approved', 'access_request', '40000000-0000-0000-0000-000000000002', 'SUCCESS', 'Reviewer approval by Unit Commander');

SELECT set_config('app.user_id', '20000000-0000-0000-0000-000000000001', true); -- Rahul
SELECT app_append_audit_event('access_request.created', 'access_request', '40000000-0000-0000-0000-000000000003', 'SUCCESS', 'Scheduled turbine inspection and diagnostic calibration');

COMMIT;
