-- ============================================================================
-- MobiTrack Pro — Cleanup Migration
-- Deletes ghost sale records (sales with 0 items) that were created due to
-- the constraint error bug (sale_items_product_type_check).
--
-- SAFE TO RUN: Only deletes sales that have NO items linked to them.
-- Real completed sales always have at least 1 item — they are NOT affected.
-- ============================================================================

-- Preview first — run this SELECT to see what will be deleted before deleting
SELECT
  s.id,
  s.invoice_number,
  s.date,
  s.customer_name,
  s.total,
  s.status,
  s.created_at
FROM sales s
WHERE NOT EXISTS (
  SELECT 1 FROM sale_items si WHERE si.sale_id = s.id
)
ORDER BY s.created_at DESC;

-- ============================================================================
-- After confirming the preview looks correct, run the DELETE below.
-- Comment out the SELECT above and uncomment the DELETE.
-- ============================================================================

-- DELETE FROM sales
-- WHERE NOT EXISTS (
--   SELECT 1 FROM sale_items si WHERE si.sale_id = id
-- );

-- ============================================================================
-- END
-- ============================================================================
