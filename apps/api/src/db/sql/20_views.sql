-- Dev B SQL: Views (Section 5.5 & 5.7)

-- 1. v_stock view
-- saleable = on_hand - reserved
-- is_low = (saleable <= low_stock_threshold)
CREATE OR REPLACE VIEW v_stock AS
SELECT
  pv.id AS variant_id,
  pv.sku,
  pv.option_label,
  p.id AS product_id,
  p.name AS product_name,
  p.category,
  COALESCE(sl.on_hand, 0) AS on_hand,
  COALESCE(sl.reserved, 0) AS reserved,
  (COALESCE(sl.on_hand, 0) - COALESCE(sl.reserved, 0)) AS saleable,
  pv.low_stock_threshold,
  ((COALESCE(sl.on_hand, 0) - COALESCE(sl.reserved, 0)) <= pv.low_stock_threshold) AS is_low
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
LEFT JOIN stock_levels sl ON pv.id = sl.variant_id;

-- 2. v_invoice_balance view (Section 5.7)
-- Charged, paid, outstanding are always separate numbers
-- status: 'unpaid', 'partial', 'paid', 'overpaid'
CREATE OR REPLACE VIEW v_invoice_balance AS
SELECT
  i.id AS invoice_id,
  i.total_paise AS charged_paise,
  COALESCE(p.paid_sum, 0) AS paid_paise,
  GREATEST(0, i.total_paise - COALESCE(p.paid_sum, 0)) AS outstanding_paise,
  CASE
    WHEN COALESCE(p.paid_sum, 0) > i.total_paise THEN 'overpaid'
    WHEN COALESCE(p.paid_sum, 0) >= i.total_paise THEN 'paid'
    WHEN COALESCE(p.paid_sum, 0) > 0 THEN 'partial'
    ELSE 'unpaid'
  END AS status
FROM invoices i
LEFT JOIN (
  SELECT
    invoice_id,
    SUM(amount_paise) AS paid_sum
  FROM payments
  GROUP BY invoice_id
) p ON i.id = p.invoice_id;
