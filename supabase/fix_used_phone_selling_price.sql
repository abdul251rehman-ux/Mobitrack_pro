-- Migration: fn_create_sale never wrote selling_price on sale
-- Run this in your Supabase SQL editor.
--
-- Root cause: when an item sells through the New Sale cart (full cash,
-- partial credit, or fully on credit - all payment types, this isn't
-- credit-specific), fn_create_sale marks it sold but never copies the
-- actual agreed sale price (already known - it's the cart's unitPrice,
-- already written to sale_items.unit_price) back onto the source row:
--   - used_phones.selling_price   (UsedPhone branch)
--   - imei_records.selling_price  (Mobile branch AND the UsedPhone
--     branch's linked imei_records row, when one exists)
-- Each is left with whatever selling_price it had before the sale, or
-- NULL if it was never priced.
--
-- Impact: every profit/revenue figure that reads one of these columns for
-- a sold row (Used Phones page stats, and anywhere selling_price is read
-- with a ?? 0 fallback) silently treats it as "sold for Rs 0" - its full
-- purchase cost then shows as a manufactured loss that never actually
-- happened. Confirmed on kumailapplestore@gmail.com's account: 10 of 32
-- sold used phones had selling_price=NULL, making "Profit: -Rs 757,000"
-- display instead of the real +Rs 173,000 the other 22 correctly-recorded
-- sales show. The imei_records side of this (Mobile branch + UsedPhone's
-- linked IMEI row) is the same bug but currently dormant - checked across
-- every tenant in this database, zero sold imei_records rows have a NULL
-- selling_price today, likely because nothing yet reads that column
-- post-sale - fixed anyway so it can't surface later as new phone sales
-- (not just used-phone ones) start relying on it.
--
-- Fix has two parts:
--   1. Patch fn_create_sale so this never happens again on new sales
--      (all three write sites above).
--   2. Backfill the historical NULL used_phones rows from their real
--      sale_items price (every affected phone's actual sale price is
--      intact there, it just never made it onto the used_phones row -
--      nothing was ever lost). No imei_records backfill is included since
--      there are currently zero affected rows to fix.

-- ── Part 1: fix fn_create_sale going forward ─────────────────────────────────
-- Full function body, unchanged except the three added selling_price writes
-- (Mobile branch's imei_records, UsedPhone branch's used_phones, and
-- UsedPhone branch's linked imei_records).

CREATE OR REPLACE FUNCTION fn_create_sale(
  p_tenant_id       UUID,
  p_date            DATE,
  p_customer_id     UUID,           -- NULL for walk-in
  p_customer_name   TEXT,
  p_customer_phone  TEXT,
  p_discount        NUMERIC,
  p_tax             NUMERIC,
  p_warranty_days   INT,            -- NULL if not applicable
  p_notes           TEXT,
  p_items           JSONB,
  p_splits          JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item            JSONB;
  v_split           JSONB;
  v_subtotal        NUMERIC := 0;
  v_grand_total     NUMERIC;
  v_total_received  NUMERIC := 0;
  v_change_due      NUMERIC;
  v_pending         NUMERIC;
  v_payment_method  TEXT;
  v_sale_status     TEXT;
  v_invoice_number  TEXT;
  v_date_tag        TEXT;
  v_max_seq         INT;
  v_sale_id         UUID;
  v_sale_row        JSONB;
  v_items_out       JSONB := '[]'::JSONB;
  v_item_row        JSONB;
  v_product_type    TEXT;
  v_product_id      UUID;
  v_quantity        INT;
  v_imei            TEXT;
  v_stock           INT;
  v_availability_status TEXT;
  v_account_type    TEXT;
  v_bank_name       TEXT;
  v_method_label    TEXT;
  v_account_name    TEXT;
  v_entity_id       UUID;
  v_credit_limit    NUMERIC;
  v_outstanding     NUMERIC;
  v_amount_on_credit NUMERIC;
  v_first_account_id UUID;
BEGIN
  -- ── Compute totals from items ────────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_subtotal := v_subtotal + (v_item->>'unitPrice')::NUMERIC * (v_item->>'quantity')::INT;
  END LOOP;

  v_grand_total := GREATEST(0, v_subtotal - COALESCE(p_discount, 0) + COALESCE(p_tax, 0));

  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    v_total_received := v_total_received + (v_split->>'amount')::NUMERIC;
  END LOOP;

  v_change_due := GREATEST(0, v_total_received - v_grand_total);
  v_pending := v_grand_total - v_total_received;
  v_sale_status := CASE WHEN v_total_received >= v_grand_total THEN 'Completed' ELSE 'Pending' END;

  -- ── Credit limit check (customer sales only) ─────────────────────────────
  IF p_customer_id IS NOT NULL THEN
    SELECT credit_limit INTO v_credit_limit FROM customers WHERE id = p_customer_id AND tenant_id = p_tenant_id;
    IF v_credit_limit IS NOT NULL AND v_credit_limit > 0 THEN
      v_amount_on_credit := v_grand_total - v_total_received;
      IF v_amount_on_credit > 0 THEN
        SELECT
          COALESCE((SELECT SUM(total) FROM sales WHERE tenant_id = p_tenant_id AND customer_id = p_customer_id AND status <> 'Refunded'), 0)
          - COALESCE((SELECT SUM(amount) FROM payments WHERE tenant_id = p_tenant_id AND entity_id = p_customer_id AND entity_type = 'Customer' AND type = 'Received' AND status = 'Completed'), 0)
        INTO v_outstanding;
        v_outstanding := GREATEST(0, v_outstanding);
        IF v_outstanding + v_amount_on_credit > v_credit_limit THEN
          RAISE EXCEPTION 'Credit limit exceeded: customer already owes % and limit is %', v_outstanding, v_credit_limit;
        END IF;
      END IF;
    END IF;
  END IF;

  -- ── Invoice number: locked generation, no client-side race ──────────────
  v_date_tag := to_char(p_date, 'YYYYMMDD');
  -- Lock against concurrent sales for this tenant/date so two sales can't compute the same sequence
  PERFORM pg_advisory_xact_lock(hashtext('invoice_seq:' || p_tenant_id::TEXT || ':' || v_date_tag));
  SELECT COALESCE(MAX((split_part(invoice_number, '-', 3))::INT), 0)
    INTO v_max_seq
    FROM sales
    WHERE tenant_id = p_tenant_id AND invoice_number LIKE 'INV-' || v_date_tag || '-%';
  v_invoice_number := 'INV-' || v_date_tag || '-' || lpad((v_max_seq + 1)::TEXT, 3, '0');

  -- ── Stock/availability re-check, right before writing (closes the gap
  --    between the old client-side check and the later write) ─────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_type := v_item->>'productType';
    v_product_id   := (v_item->>'productId')::UUID;
    v_quantity     := (v_item->>'quantity')::INT;

    IF v_product_type = 'UsedPhone' THEN
      SELECT status INTO v_availability_status FROM used_phones WHERE id = v_product_id AND tenant_id = p_tenant_id;
      IF v_availability_status IS DISTINCT FROM 'in_stock' THEN
        RAISE EXCEPTION 'Item "%" is no longer available', v_item->>'productName';
      END IF;
    ELSIF v_product_type = 'Mobile' THEN
      SELECT device_status INTO v_availability_status FROM imei_records WHERE id = v_product_id AND tenant_id = p_tenant_id;
      IF v_availability_status IS DISTINCT FROM 'in_stock' THEN
        RAISE EXCEPTION 'Item "%" (IMEI record) is no longer available', v_item->>'productName';
      END IF;
    ELSE -- Accessory
      SELECT stock INTO v_stock FROM accessories WHERE id = v_product_id AND tenant_id = p_tenant_id;
      IF v_stock IS NULL OR v_stock < v_quantity THEN
        RAISE EXCEPTION 'Item "%" - only % left in stock', v_item->>'productName', COALESCE(v_stock, 0);
      END IF;
    END IF;
  END LOOP;

  -- ── Payment method label (mirrors the client-side derivation) ────────────
  v_first_account_id := NULL;
  IF jsonb_array_length(p_splits) > 1 THEN
    v_payment_method := 'Split Payment';
  ELSIF jsonb_array_length(p_splits) = 1 THEN
    v_first_account_id := (p_splits->0->>'accountId')::UUID;
    SELECT type, bank_name, name INTO v_account_type, v_bank_name, v_account_name
      FROM finance_accounts WHERE id = v_first_account_id AND tenant_id = p_tenant_id;
    v_payment_method := CASE v_account_type
      WHEN 'cash' THEN 'Cash' WHEN 'bank' THEN 'Bank Transfer' ELSE COALESCE(v_bank_name, 'Mobile Wallet') END;
  ELSE
    v_payment_method := 'Cash';
  END IF;

  -- ── Insert sale header ────────────────────────────────────────────────────
  INSERT INTO sales (
    tenant_id, invoice_number, date, customer_id, customer_name, customer_phone,
    subtotal, discount, tax, total, payment_method, amount_received, change_due,
    status, warranty_days, notes
  ) VALUES (
    p_tenant_id, v_invoice_number, p_date, p_customer_id, p_customer_name, p_customer_phone,
    v_subtotal, COALESCE(p_discount, 0), COALESCE(p_tax, 0), v_grand_total, v_payment_method,
    v_total_received, v_change_due, v_sale_status, p_warranty_days, NULLIF(p_notes, '')
  )
  RETURNING id INTO v_sale_id;

  -- ── Insert sale_items + apply inventory/customer side effects ────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_type := v_item->>'productType';
    v_product_id   := (v_item->>'productId')::UUID;
    v_quantity     := (v_item->>'quantity')::INT;
    v_imei         := NULLIF(v_item->>'imei', '');

    INSERT INTO sale_items (
      tenant_id, sale_id, product_id, product_name, product_type, quantity, unit_price, discount, line_total, imei
    ) VALUES (
      p_tenant_id, v_sale_id, v_product_id, v_item->>'productName',
      CASE WHEN v_product_type = 'UsedPhone' THEN 'Mobile' ELSE v_product_type END,
      v_quantity, (v_item->>'unitPrice')::NUMERIC, COALESCE((v_item->>'discount')::NUMERIC, 0),
      (v_item->>'lineTotal')::NUMERIC, v_imei
    )
    RETURNING to_jsonb(sale_items.*) INTO v_item_row;
    v_items_out := v_items_out || jsonb_build_array(v_item_row);

    IF v_product_type = 'Mobile' THEN
      -- v_product_id here is the imei_records.id (matches app/sales/new/page.tsx cart wiring)
      -- Same selling_price fix as the UsedPhone branch below - this row's price
      -- was never being recorded either.
      UPDATE imei_records
        SET device_status = 'sold', sold_date = p_date,
            customer_name = p_customer_name, customer_phone = p_customer_phone, customer_id = p_customer_id,
            selling_price = (v_item->>'unitPrice')::NUMERIC
        WHERE id = v_product_id AND tenant_id = p_tenant_id;
      UPDATE mobiles SET stock = GREATEST(0, stock - v_quantity)
        WHERE id = (SELECT product_id FROM imei_records WHERE id = v_product_id AND tenant_id = p_tenant_id)
          AND tenant_id = p_tenant_id;
    ELSIF v_product_type = 'Accessory' THEN
      UPDATE accessories SET stock = GREATEST(0, stock - v_quantity) WHERE id = v_product_id AND tenant_id = p_tenant_id;
    ELSIF v_product_type = 'UsedPhone' THEN
      -- FIX: now also writes the real agreed sale price back onto the phone
      -- (previously only status/sold_date/customer were updated, leaving
      -- selling_price stuck at NULL or a stale pre-sale value forever).
      UPDATE used_phones SET status = 'sold', sold_date = p_date, source_customer_name = p_customer_name,
             selling_price = (v_item->>'unitPrice')::NUMERIC
        WHERE id = v_product_id AND tenant_id = p_tenant_id;
      IF v_imei IS NOT NULL THEN
        -- Same fix applies here: imei_records has its own selling_price column
        -- (currently unread anywhere post-sale, but left correct rather than
        -- stale/NULL - same reasoning as used_phones above).
        UPDATE imei_records SET device_status = 'sold', sold_date = p_date, customer_name = p_customer_name,
               selling_price = (v_item->>'unitPrice')::NUMERIC
          WHERE imei_number = v_imei AND tenant_id = p_tenant_id AND product_id IS NULL;
      END IF;
    END IF;
  END LOOP;

  -- ── Customer stats + loyalty tier (absorbed from update_customer_on_sale
  --    / update_customer_loyalty triggers) ─────────────────────────────────
  IF p_customer_id IS NOT NULL AND v_sale_status = 'Completed' THEN
    UPDATE customers SET
      total_purchases = total_purchases + 1,
      total_spent = total_spent + v_grand_total,
      last_purchase_date = p_date,
      loyalty_tier = CASE
        WHEN total_spent + v_grand_total >= 500000 THEN 'Platinum'
        WHEN total_spent + v_grand_total >= 200000 THEN 'Gold'
        WHEN total_spent + v_grand_total >= 50000  THEN 'Silver'
        ELSE 'Bronze'
      END
    WHERE id = p_customer_id AND tenant_id = p_tenant_id;
  END IF;

  -- ── Payments: one row per received split, plus a Pending row for any balance ─
  v_entity_id := p_customer_id;
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    SELECT type, bank_name, name INTO v_account_type, v_bank_name, v_account_name
      FROM finance_accounts WHERE id = (v_split->>'accountId')::UUID AND tenant_id = p_tenant_id;
    v_method_label := CASE v_account_type
      WHEN 'cash' THEN 'Cash' WHEN 'bank' THEN 'Bank Transfer' ELSE COALESCE(v_bank_name, 'Mobile Wallet') END;

    INSERT INTO payments (
      tenant_id, date, type, entity_type, entity_id, entity_name, reference_type,
      reference_number, amount, method, status, notes
    ) VALUES (
      p_tenant_id, p_date, 'Received', 'Customer', v_entity_id, p_customer_name, 'Sale',
      v_invoice_number, (v_split->>'amount')::NUMERIC, v_method_label, 'Completed',
      'Payment for ' || v_invoice_number ||
        CASE WHEN jsonb_array_length(p_splits) > 1 THEN ' (' || COALESCE(v_account_name, v_method_label) || ')' ELSE '' END
    );
  END LOOP;

  IF v_pending > 0 THEN
    INSERT INTO payments (
      tenant_id, date, type, entity_type, entity_id, entity_name, reference_type,
      reference_number, amount, method, status, notes
    ) VALUES (
      p_tenant_id, p_date, 'Received', 'Customer', v_entity_id, p_customer_name, 'Sale',
      v_invoice_number, v_pending, v_payment_method, 'Pending', 'Outstanding for ' || v_invoice_number
    );
  END IF;

  -- ── Finance: transaction log + balance update, row-locked to prevent races ──
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    INSERT INTO finance_transactions (
      tenant_id, date, type, account_id, amount, reference_type, reference_number, description
    ) VALUES (
      p_tenant_id, p_date, 'sale_receipt', (v_split->>'accountId')::UUID, (v_split->>'amount')::NUMERIC,
      'Sale', v_invoice_number, 'Sale received - ' || v_invoice_number
    );

    -- SELECT ... FOR UPDATE locks this account row until the transaction ends,
    -- so a second concurrent payment against the same account waits instead
    -- of reading a stale balance and overwriting the first payment's update.
    PERFORM 1 FROM finance_accounts WHERE id = (v_split->>'accountId')::UUID AND tenant_id = p_tenant_id FOR UPDATE;
    UPDATE finance_accounts SET current_balance = current_balance + (v_split->>'amount')::NUMERIC
      WHERE id = (v_split->>'accountId')::UUID AND tenant_id = p_tenant_id;
  END LOOP;

  IF v_first_account_id IS NOT NULL THEN
    UPDATE sales SET account_id = v_first_account_id WHERE id = v_sale_id AND tenant_id = p_tenant_id;
  END IF;

  SELECT to_jsonb(sales.*) INTO v_sale_row FROM sales WHERE id = v_sale_id;

  RETURN jsonb_build_object('sale', v_sale_row, 'items', v_items_out);
END;
$$;

-- ── Part 2: backfill historical NULL selling_price rows ──────────────────────
-- Pulls the real sale price from sale_items (product_type='Mobile' - used
-- phones are stored as 'Mobile' in sale_items, see the CASE in the INSERT
-- above) for any sold used_phones row that's missing its selling_price.
-- sale_items has no created_at of its own, so recency is taken from its
-- parent sales.date instead - picks the most recent sale per phone, in case
-- a phone was ever sold/returned/resold and has more than one sale_items row.

UPDATE used_phones up
SET selling_price = si.unit_price
FROM (
  SELECT DISTINCT ON (si.product_id) si.product_id, si.unit_price
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  WHERE si.product_type = 'Mobile'
  ORDER BY si.product_id, s.date DESC, s.created_at DESC
) si
WHERE up.id = si.product_id
  AND up.status = 'sold'
  AND up.selling_price IS NULL;

-- ── Verification ──────────────────────────────────────────────────────────
-- Run after applying to see how many rows were fixed and confirm none remain:
--
-- SELECT tenant_id, count(*) AS still_null
-- FROM used_phones
-- WHERE status = 'sold' AND selling_price IS NULL
-- GROUP BY tenant_id;
