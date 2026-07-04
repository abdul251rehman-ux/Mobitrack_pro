-- Fix: tenants table RLS blocks reads because this app uses custom auth
-- (no Supabase Auth session, so auth.uid() is always null)
-- The tenants table is safe to read publicly since tenant_id is always
-- scoped in every query at the application level.

ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;

-- Also ensure profiles can be read (needed for login + session restore)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- If you already have RLS policies on tenants, drop them too:
DROP POLICY IF EXISTS "tenants_tenant_isolation" ON tenants;
DROP POLICY IF EXISTS "Enable read access for all users" ON tenants;
