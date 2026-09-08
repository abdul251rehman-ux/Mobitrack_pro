-- ============================================================================
-- DELETE A TRIAL TENANT AND ALL ITS DATA (login, business data, everything)
-- Run this in your Supabase SQL editor.
--
-- DESTRUCTIVE / IRREVERSIBLE. This permanently deletes:
--   - the tenant (shop) row
--   - every staff login under it (profiles) - they can no longer sign in
--   - every sale, purchase, product, customer, supplier, expense, etc. -
--     every table with a tenant_id column cascades on tenant delete
--   - purchase_returns rows for this tenant (deleted explicitly below - that
--     table's tenant_id has no foreign key, so it would NOT cascade otherwise
--     and would be silently left behind)
--
-- NOT covered by this script (do these separately if needed):
--   - Supabase Storage files (e.g. product photos in the "product-images"
--     bucket, stored under paths like mobiles/<tenant_id>/...). SQL DELETE
--     does not touch Storage - remove those from Storage > product-images
--     in the dashboard if this tenant uploaded any images.
--
-- STEP 1 - Find the tenant. Confirm this is the right one BEFORE running
-- step 2 - check the tenant name/owner, not just the email, since the
-- login email lives on `profiles`, not `tenants`.
-- ============================================================================

SELECT t.id AS tenant_id, t.name AS shop_name, t.owner_name, t.email AS tenant_email,
       p.id AS profile_id, p.name AS login_name, p.email AS login_email, p.role
FROM tenants t
LEFT JOIN profiles p ON p.tenant_id = t.id
WHERE p.email = 'abd@gmail.com'
   OR t.email = 'abd@gmail.com';

-- ============================================================================
-- STEP 2 - Once you've confirmed the tenant_id from Step 1's result, paste
-- it below in place of the sub-select (or just leave the sub-select - it
-- resolves the same tenant_id automatically as long as only one tenant
-- matches). This runs both deletes as one transaction: either both succeed
-- or neither does, so you can't end up with the tenant gone but returns left
-- behind (or vice versa).
-- ============================================================================

BEGIN;

  -- purchase_returns.tenant_id has no FK - delete explicitly so it doesn't
  -- get silently left behind when the tenant row disappears below.
  DELETE FROM purchase_returns
  WHERE tenant_id = (
    SELECT t.id FROM tenants t
    JOIN profiles p ON p.tenant_id = t.id
    WHERE p.email = 'abd@gmail.com'
    LIMIT 1
  );

  -- Deletes the tenant - cascades to profiles (logins), sales, purchases,
  -- products, customers, suppliers, expenses, and every other tenant-scoped
  -- table (all declared ON DELETE CASCADE tenants(id) in migration.sql).
  DELETE FROM tenants
  WHERE id = (
    SELECT t.id FROM tenants t
    JOIN profiles p ON p.tenant_id = t.id
    WHERE p.email = 'abd@gmail.com'
    LIMIT 1
  );

COMMIT;

-- ============================================================================
-- STEP 3 - Verify nothing is left.
-- ============================================================================

SELECT * FROM profiles WHERE email = 'abd@gmail.com';   -- should return 0 rows
SELECT * FROM tenants WHERE email = 'abd@gmail.com';     -- should return 0 rows
