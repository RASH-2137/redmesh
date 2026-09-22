-- ============================================================
-- REDmesh User Display Summary Function
-- Allows reading display name, role, and unit for authorized records
-- ============================================================

CREATE OR REPLACE FUNCTION app_get_user_summary(target_user_id UUID)
RETURNS TABLE (
    display_name TEXT,
    username TEXT,
    role_name TEXT,
    unit_code TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT 
        u.display_name,
        u.username,
        r.name AS role_name,
        un.code AS unit_code
    FROM public.users u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    LEFT JOIN public.roles r ON r.id = ur.role_id
    LEFT JOIN public.units un ON un.id = u.unit_id
    WHERE u.id = target_user_id
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION app_get_user_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_get_user_summary(UUID) TO redmesh_app;
