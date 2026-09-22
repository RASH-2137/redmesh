-- ============================================================
-- REDmesh Demo Seed Data
-- Fictional identities, units, roles and assets.
-- ============================================================

BEGIN;

-- ============================================================
-- Roles
-- ============================================================

INSERT INTO roles (id, name, description)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'MECHANIC',
     'Maintains and services assigned assets'),
    ('00000000-0000-0000-0000-000000000002', 'COMMANDER',
     'Commands and approves access within assigned authority'),
    ('00000000-0000-0000-0000-000000000003', 'AUDITOR',
     'Reviews security and audit activity'),
    ('00000000-0000-0000-0000-000000000004', 'CONTRACTOR',
     'External personnel with restricted access'),
    ('00000000-0000-0000-0000-000000000005', 'ADMIN',
     'Platform administration')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Units
-- ============================================================

INSERT INTO units (id, code, name)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'AIR-17',
     'Air Systems Unit 17'),
    ('10000000-0000-0000-0000-000000000002', 'CIV-04',
     'Civilian Support Unit 04')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Users
-- ============================================================

INSERT INTO users (
    id,
    username,
    display_name,
    clearance,
    unit_id,
    password_hash
)
VALUES
    (
        '20000000-0000-0000-0000-000000000001',
        'rahul',
        'Rahul',
        'SECRET',
        '10000000-0000-0000-0000-000000000001',
        '$argon2id$v=19$m=65536,t=3,p=4$placeholder$placeholder'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        'alex',
        'Alex',
        'TOP_SECRET',
        '10000000-0000-0000-0000-000000000001',
        '$argon2id$v=19$m=65536,t=3,p=4$placeholder$placeholder'
    ),
    (
        '20000000-0000-0000-0000-000000000003',
        'john',
        'John',
        'CONFIDENTIAL',
        '10000000-0000-0000-0000-000000000002',
        '$argon2id$v=19$m=65536,t=3,p=4$placeholder$placeholder'
    )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- User Roles
-- ============================================================

INSERT INTO user_roles (user_id, role_id)
VALUES
    (
        '20000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000002'
    ),
    (
        '20000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000004'
    )
ON CONFLICT DO NOTHING;

-- ============================================================
-- Assets
-- ============================================================

INSERT INTO assets (
    id,
    asset_code,
    name,
    asset_type,
    classification,
    unit_id,
    status
)
VALUES
    (
        '30000000-0000-0000-0000-000000000001',
        'ENG-4721',
        'Aircraft Engine',
        'ENGINE',
        'SECRET',
        '10000000-0000-0000-0000-000000000001',
        'AVAILABLE'
    ),
    (
        '30000000-0000-0000-0000-000000000002',
        'RAD-8812',
        'Radar Module',
        'RADAR',
        'TOP_SECRET',
        '10000000-0000-0000-0000-000000000001',
        'AVAILABLE'
    ),
    (
        '30000000-0000-0000-0000-000000000003',
        'COM-2931',
        'Communications Module',
        'COMMUNICATION',
        'CONFIDENTIAL',
        '10000000-0000-0000-0000-000000000001',
        'AVAILABLE'
    )
ON CONFLICT (id) DO NOTHING;

COMMIT;