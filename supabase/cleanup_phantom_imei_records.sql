-- =============================================================================
-- Cleanup: Phantom imei_records rows created by old bulk used-phone add bug
--
-- Root cause: app/inventory/used-phones/page.tsx (bulk add) was incorrectly
-- inserting a row into imei_records for every used phone added. These rows
-- have product_id = NULL (no catalog mobile link) and purchase_id = NULL,
-- which distinguishes them from legitimate new-phone purchase records.
--
-- Effect: each used phone appeared TWICE in New Sale — once as "Used" (correct)
-- and once as a phantom "Mobile" (wrong).
--
-- Run this ONCE in the Supabase SQL editor AFTER deploying the code fix.
-- =============================================================================

-- STEP 1: Preview what will be deleted (run this first, review output)
SELECT
  id,
  imei_number,
  brand,
  model,
  device_status,
  supplier_name,
  purchase_date,
  created_at
FROM imei_records
WHERE product_id IS NULL
  AND purchase_id IS NULL
ORDER BY created_at DESC;

-- STEP 2: Verify there is a matching used_phones row for each phantom
-- (confirms these are genuinely used-phone phantoms, not orphaned legit records)
SELECT
  ir.id              AS phantom_imei_record_id,
  ir.imei_number,
  ir.brand,
  ir.model,
  ir.device_status   AS imei_device_status,
  up.id              AS used_phone_id,
  up.status          AS used_phone_status
FROM imei_records ir
LEFT JOIN used_phones up ON up.imei_number = ir.imei_number AND up.tenant_id = ir.tenant_id
WHERE ir.product_id IS NULL
  AND ir.purchase_id IS NULL
ORDER BY ir.created_at DESC;

-- STEP 3: Delete the phantom rows
-- Only run after reviewing STEP 1 and STEP 2 output above.
DELETE FROM imei_records
WHERE product_id IS NULL
  AND purchase_id IS NULL;
