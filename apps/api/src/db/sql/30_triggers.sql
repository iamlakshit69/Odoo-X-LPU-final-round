-- Dev B SQL: Triggers & Invariant Enforcement (Section 4 & Section 5)

-- 1. Trigger to maintain stock_levels on stock_movements
--    Uses UPDATE-then-INSERT approach to avoid CHECK violation on the UPSERT INSERT path.
--    Postgres validates CHECK on INSERT values before ON CONFLICT, so a negative delta
--    would trigger check_on_hand_non_negative on the INSERT attempt even with ON CONFLICT.
CREATE OR REPLACE FUNCTION trg_stock_movement_apply()
RETURNS TRIGGER AS $$
BEGIN
  -- Try UPDATE first; if no row exists, INSERT with on_hand = delta (only valid for positive deltas)
  UPDATE stock_levels
  SET on_hand = on_hand + NEW.delta
  WHERE variant_id = NEW.variant_id;

  IF NOT FOUND THEN
    -- Row doesn't exist yet; only create it for positive deltas (receipts)
    IF NEW.delta >= 0 THEN
      INSERT INTO stock_levels (variant_id, on_hand, reserved)
      VALUES (NEW.variant_id, NEW.delta, 0);
    ELSE
      -- Negative delta with no existing row: should not happen in normal flow
      RAISE EXCEPTION 'Cannot apply negative stock movement: no stock_levels row for variant %', NEW.variant_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_movement_apply ON stock_movements;
CREATE TRIGGER trg_stock_movement_apply
AFTER INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION trg_stock_movement_apply();

-- 2. Trigger to maintain stock_levels reserved count on stock_reservations
CREATE OR REPLACE FUNCTION trg_stock_reservation_apply()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      INSERT INTO stock_levels (variant_id, on_hand, reserved)
      VALUES (NEW.variant_id, 0, NEW.qty)
      ON CONFLICT (variant_id)
      DO UPDATE SET reserved = stock_levels.reserved + EXCLUDED.reserved;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'active' AND NEW.status IN ('released', 'converted') THEN
      UPDATE stock_levels
      SET reserved = reserved - OLD.qty
      WHERE variant_id = NEW.variant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_reservation_apply ON stock_reservations;
CREATE TRIGGER trg_stock_reservation_apply
AFTER INSERT OR UPDATE ON stock_reservations
FOR EACH ROW
EXECUTE FUNCTION trg_stock_reservation_apply();

-- 3. Trigger to prevent overpayment on invoices (Section 4 Rule 1 & Section 14 T9)
-- Non-refund payments cannot cause sum(payments) > total_paise
CREATE OR REPLACE FUNCTION trg_check_payment_overpayment()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_total INT;
  v_current_paid INT;
BEGIN
  -- Refunds have negative amount_paise; only check non-refund payments
  IF NEW.amount_paise > 0 THEN
    SELECT total_paise INTO v_invoice_total
    FROM invoices
    WHERE id = NEW.invoice_id;

    IF v_invoice_total IS NULL THEN
      RAISE EXCEPTION 'Invoice % not found', NEW.invoice_id USING ERRCODE = 'P0002';
    END IF;

    SELECT COALESCE(SUM(amount_paise), 0) INTO v_current_paid
    FROM payments
    WHERE invoice_id = NEW.invoice_id;

    IF (v_current_paid + NEW.amount_paise) > v_invoice_total THEN
      RAISE EXCEPTION 'OVERPAYMENT: Total paid (%) would exceed invoice total (%)',
        (v_current_paid + NEW.amount_paise), v_invoice_total
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_payment_overpayment ON payments;
CREATE TRIGGER trg_check_payment_overpayment
BEFORE INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION trg_check_payment_overpayment();

-- 4. Append-Only Ledgers Enforcers (Section 4 Rule 2)
-- stock_movements, payments, and tab_events are strictly append-only

CREATE OR REPLACE FUNCTION trg_prevent_update_or_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger tables are append-only. Updates and deletes are prohibited.'
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_movements_append_only ON stock_movements;
CREATE TRIGGER trg_stock_movements_append_only
BEFORE UPDATE OR DELETE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_update_or_delete();

DROP TRIGGER IF EXISTS trg_payments_append_only ON payments;
CREATE TRIGGER trg_payments_append_only
BEFORE UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_update_or_delete();

DROP TRIGGER IF EXISTS trg_tab_events_append_only ON tab_events;
CREATE TRIGGER trg_tab_events_append_only
BEFORE UPDATE OR DELETE ON tab_events
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_update_or_delete();

-- 5. Auto-create stock_levels row for new variants
CREATE OR REPLACE FUNCTION trg_auto_create_stock_levels()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO stock_levels (variant_id, on_hand, reserved)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (variant_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_create_stock_levels ON product_variants;
CREATE TRIGGER trg_auto_create_stock_levels
AFTER INSERT ON product_variants
FOR EACH ROW
EXECUTE FUNCTION trg_auto_create_stock_levels();

-- 6. Sequence for Invoice Numbers: INV-<year>-<6 digits>
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;
