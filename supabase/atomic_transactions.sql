-- ============================================================================
-- Atomic money-flow transactions
--
-- Replaces multi-step client-side write sequences (create sale, void sale,
-- and — in a later pass — create purchase, edit purchase, returns, supplier
-- payment) with single Postgres functions. Each function's body runs inside
-- one implicit transaction: any RAISE EXCEPTION rolls back every write the
-- function made, so a failure partway through can never leave a half-saved
-- sale/purchase/payment behind.
--
-- Tenant scoping: functions take p_tenant_id explicitly and use it in every
-- WHERE/INSERT rather than relying on the app's session-variable RLS trick
-- (set_tenant_context), which has a documented failure mode under Supabase's
-- pooled connections (see fix_rls_pooling.sql) — a function parameter can't
-- silently go missing the way a session variable can.
--
-- SECURITY DEFINER: the anon/authenticated Supabase role calls these
-- functions directly; the function body is the trust boundary (all reads/
-- writes are scoped to the passed-in p_tenant_id, mirroring how the RLS
-- policies already scope by tenant_id today).
-- ============================================================================


-- ============================================================================
-- fn_create_sale
--
-- Replaces: app/sales/new/page.tsx handleConfirmSale (~613-754)
--           + lib/api/sales.ts createSale (~95-127)
--
-- p_items shape (JSONB array), one element per cart line:
--   {
--     "productId": uuid, "productName": text, "productType": "Mobile"|"Accessory"|"UsedPhone",
--     "quantity": int, "unitPrice": numeric, "discount": numeric, "lineTotal": numeric,
--     "imei": text|null
--   }
--
-- p_splits shape (JSONB array), one element per payment account used:
--   { "accountId": uuid, "amount": numeric }
--
-- Absorbs what today happens as ~15 separate network calls:
--   - invoice number generation (moved server-side + locked, closing the
--     race where two concurrent sales could compute the same number)
--   - stock/availability re-check for every item, right before decrementing
--     (today this is checked once client-side, then written to separately —
--     a gap where stock can change in between; here it's one atomic step)
--   - sales + sale_items insert
--   - per Mobile item: imei_records -> sold, mobiles.stock decrement
--   - per Accessory item: accessories.stock decrement
--   - per UsedPhone item: used_phones -> sold (+ imei_records if present)
--   - customer stats bump (total_purchases/total_spent/last_purchase_date)
--     and loyalty_tier recompute — logic absorbed from the
--     update_customer_on_sale / update_customer_loyalty triggers, which are
--     dropped at the bottom of this file once this function is verified
--   - payments insert (received splits + one "Pending" row for any balance)
--   - finance_transactions insert + finance_accounts.current_balance update,
--     guarded with SELECT ... FOR UPDATE on the account row so two payments
--     landing at nearly the same time can never lose one of them (today only
--     purchases/new-purchase-sheet.tsx does this; sale-new does not)
--   - sales.account_id update
--
-- Returns: JSONB { "sale": {...row...}, "items": [...rows...] }
-- ============================================================================

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
      UPDATE imei_records
        SET device_status = 'sold', sold_date = p_date,
            customer_name = p_customer_name, customer_phone = p_customer_phone, customer_id = p_customer_id
        WHERE id = v_product_id AND tenant_id = p_tenant_id;
      UPDATE mobiles SET stock = GREATEST(0, stock - v_quantity)
        WHERE id = (SELECT product_id FROM imei_records WHERE id = v_product_id AND tenant_id = p_tenant_id)
          AND tenant_id = p_tenant_id;
    ELSIF v_product_type = 'Accessory' THEN
      UPDATE accessories SET stock = GREATEST(0, stock - v_quantity) WHERE id = v_product_id AND tenant_id = p_tenant_id;
    ELSIF v_product_type = 'UsedPhone' THEN
      UPDATE used_phones SET status = 'sold', sold_date = p_date, source_customer_name = p_customer_name
        WHERE id = v_product_id AND tenant_id = p_tenant_id;
      IF v_imei IS NOT NULL THEN
        UPDATE imei_records SET device_status = 'sold', sold_date = p_date, customer_name = p_customer_name
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

GRANT EXECUTE ON FUNCTION fn_create_sale(UUID, DATE, UUID, TEXT, TEXT, NUMERIC, NUMERIC, INT, TEXT, JSONB, JSONB) TO anon, authenticated;


-- ============================================================================
-- fn_void_sale
--
-- Replaces: app/sales/page.tsx handleDeleteSale (~100-160)
-- which today has ZERO error checks on any of its 8 writes.
--
-- Real bug fixed here vs. the old code: sale_items.product_type collapses
-- "UsedPhone" into "Mobile" at save time (see toDbSaleItem), so the old
-- delete handler — which branches on that same collapsed product_type —
-- cannot tell a used-phone line item from a real catalog-mobile line item,
-- and silently fails to restore a sold used phone to in_stock. This function
-- disambiguates by checking which table actually has a row for product_id
-- instead of trusting the collapsed type string.
--
-- Also fixes: the old handler never reversed the customers.total_purchases/
-- total_spent bump that update_customer_on_sale applied at creation time —
-- this function reverses it and recomputes loyalty_tier accordingly.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_void_sale(
  p_tenant_id UUID,
  p_sale_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale            RECORD;
  v_item            RECORD;
  v_txn             RECORD;
  v_is_used_phone   BOOLEAN;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  -- ── Reverse inventory per item ────────────────────────────────────────────
  FOR v_item IN
    SELECT product_id, product_type, quantity, imei
    FROM sale_items
    WHERE sale_id = p_sale_id AND tenant_id = p_tenant_id
  LOOP
    IF v_item.product_type = 'Mobile' AND v_item.product_id IS NOT NULL THEN
      -- Disambiguate UsedPhone vs real Mobile by which table actually owns this id
      SELECT EXISTS(SELECT 1 FROM used_phones WHERE id = v_item.product_id AND tenant_id = p_tenant_id) INTO v_is_used_phone;

      IF v_is_used_phone THEN
        UPDATE used_phones SET status = 'in_stock', sold_date = NULL, source_customer_name = NULL
          WHERE id = v_item.product_id AND tenant_id = p_tenant_id;
        IF v_item.imei IS NOT NULL THEN
          UPDATE imei_records SET device_status = 'in_stock', sold_date = NULL, customer_name = NULL
            WHERE imei_number = v_item.imei AND tenant_id = p_tenant_id AND product_id IS NULL;
        END IF;
      ELSE
        IF v_item.imei IS NOT NULL THEN
          UPDATE imei_records
            SET device_status = 'in_stock', sold_date = NULL, customer_name = NULL, customer_phone = NULL, customer_id = NULL
            WHERE imei_number = v_item.imei AND tenant_id = p_tenant_id;
        END IF;
        UPDATE mobiles SET stock = stock + v_item.quantity
          WHERE id = (SELECT product_id FROM imei_records WHERE imei_number = v_item.imei AND tenant_id = p_tenant_id)
            AND tenant_id = p_tenant_id;
      END IF;
    ELSIF v_item.product_type = 'Accessory' AND v_item.product_id IS NOT NULL THEN
      UPDATE accessories SET stock = stock + v_item.quantity WHERE id = v_item.product_id AND tenant_id = p_tenant_id;
    END IF;
  END LOOP;

  -- ── Reverse finance account balances (row-locked, same pattern as create) ──
  FOR v_txn IN
    SELECT account_id, amount FROM finance_transactions
    WHERE reference_number = v_sale.invoice_number AND tenant_id = p_tenant_id AND type = 'sale_receipt'
  LOOP
    PERFORM 1 FROM finance_accounts WHERE id = v_txn.account_id AND tenant_id = p_tenant_id FOR UPDATE;
    UPDATE finance_accounts SET current_balance = current_balance - v_txn.amount
      WHERE id = v_txn.account_id AND tenant_id = p_tenant_id;
  END LOOP;

  -- ── Reverse customer stats bump (bug fix: old code never did this) ────────
  IF v_sale.customer_id IS NOT NULL AND v_sale.status = 'Completed' THEN
    UPDATE customers SET
      total_purchases = GREATEST(0, total_purchases - 1),
      total_spent = GREATEST(0, total_spent - v_sale.total),
      loyalty_tier = CASE
        WHEN GREATEST(0, total_spent - v_sale.total) >= 500000 THEN 'Platinum'
        WHEN GREATEST(0, total_spent - v_sale.total) >= 200000 THEN 'Gold'
        WHEN GREATEST(0, total_spent - v_sale.total) >= 50000  THEN 'Silver'
        ELSE 'Bronze'
      END
    WHERE id = v_sale.customer_id AND tenant_id = p_tenant_id;
  END IF;

  -- ── Delete records, then the sale itself ─────────────────────────────────
  DELETE FROM finance_transactions WHERE reference_number = v_sale.invoice_number AND tenant_id = p_tenant_id;
  DELETE FROM payments WHERE reference_number = v_sale.invoice_number AND tenant_id = p_tenant_id;
  DELETE FROM sale_items WHERE sale_id = p_sale_id AND tenant_id = p_tenant_id;
  DELETE FROM sales WHERE id = p_sale_id AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object('voided_sale_id', p_sale_id, 'invoice_number', v_sale.invoice_number);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_void_sale(UUID, UUID) TO anon, authenticated;


-- ============================================================================
-- Trigger removal — sale-side triggers only
--
-- fn_create_sale and fn_void_sale fully absorb what these two triggers did,
-- so they must be dropped NOW, in this same file, not deferred:
--
--   - sale_item_stock_decrement would otherwise fire a second time on the
--     sale_items insert inside fn_create_sale. For Accessory items this is
--     a real double-decrement (the trigger's UPDATE ... WHERE id = NEW.product_id
--     correctly matches an accessories row). For Mobile items the trigger has
--     always been a silent no-op — NEW.product_id on a Mobile sale_items row
--     is imei_records.id, not mobiles.id, so its UPDATE matches zero rows —
--     which is exactly why the original app code had to decrement mobiles
--     stock by hand in the first place.
--   - sale_update_customer would double-apply the total_purchases/total_spent
--     bump that fn_create_sale now also applies inline.
--
-- purchase_item_stock_increment / purchase_update_supplier / customer_loyalty_trigger
-- are NOT touched here — purchase creation still runs on the old flow until
-- its own atomic pass, and depends on them.
-- ============================================================================

DROP TRIGGER IF EXISTS sale_item_stock_decrement ON sale_items;
DROP TRIGGER IF EXISTS sale_update_customer ON sales;
