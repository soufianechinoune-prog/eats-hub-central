-- =========================================================
-- Option B : versements recalculés depuis orders + payout_adjustments
-- Anti-fan-out : agrégats séparés puis FULL OUTER JOIN
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_monthly_payouts_detail(
  p_year integer,
  p_month integer,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  restaurant_id uuid, payout_date date,
  sales_incl_vat numeric, sales_excl_vat numeric,
  refund_incl_vat numeric, refund_excl_vat numeric, vat_refund numeric,
  item_promo_incl_vat numeric, item_promo_excl_vat numeric,
  uber_fee_after_promo_incl_vat numeric, uber_fee_after_promo_excl_vat numeric,
  uber_fee_before_promo_excl_vat numeric, uber_fee_promo_excl_vat numeric, vat_uber_fee numeric,
  delivery_promo_incl_vat numeric, delivery_promo_excl_vat numeric,
  price_adjustment_incl_vat numeric, price_adjustment_excl_vat numeric,
  other_payments_incl_vat numeric, net_payout numeric, order_count integer,
  tips numeric, marketing_fee_adjustment numeric, meal_voucher_amount numeric,
  eco_contribution_refund numeric, eco_contribution_charge numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH ord AS (
    SELECT
      o.restaurant_id AS rid,
      o.payout_date   AS pdate,
      COALESCE(SUM(o.sales_incl_vat),0) AS sales_incl_vat,
      COALESCE(SUM(o.sales_excl_vat),0) AS sales_excl_vat,
      COALESCE(SUM(o.refund_incl_vat),0) AS refund_incl_vat,
      COALESCE(SUM(o.refund_excl_vat),0) AS refund_excl_vat,
      COALESCE(SUM(COALESCE(o.vat_1_refund,0)+COALESCE(o.vat_2_refund,0)+COALESCE(o.vat_3_refund,0)),0) AS vat_refund,
      COALESCE(SUM(o.item_promo_incl_vat),0) AS item_promo_incl_vat,
      COALESCE(SUM(o.item_promo_excl_vat),0) AS item_promo_excl_vat,
      COALESCE(SUM(o.uber_fee_after_promo_incl_vat),0) AS uber_fee_after_promo_incl_vat,
      COALESCE(SUM(o.uber_fee_after_promo_excl_vat),0) AS uber_fee_after_promo_excl_vat,
      COALESCE(SUM(o.uber_fee_before_promo_excl_vat),0) AS uber_fee_before_promo_excl_vat,
      COALESCE(SUM(o.uber_fee_promo_excl_vat),0) AS uber_fee_promo_excl_vat,
      COALESCE(SUM(o.vat_uber_fee),0) AS vat_uber_fee,
      COALESCE(SUM(o.delivery_promo_incl_vat),0) AS delivery_promo_incl_vat,
      COALESCE(SUM(o.delivery_promo_excl_vat),0) AS delivery_promo_excl_vat,
      COALESCE(SUM(o.price_adjustment_incl_vat),0) AS price_adjustment_incl_vat,
      COALESCE(SUM(o.price_adjustment_excl_vat),0) AS price_adjustment_excl_vat,
      COALESCE(SUM(o.other_payments_incl_vat),0) AS other_payments_incl_vat,
      COALESCE(SUM(o.net_payout),0) AS net_payout,
      COUNT(*)::integer AS order_count,
      COALESCE(SUM(o.tip_amount),0) AS tips,
      COALESCE(SUM(o.marketing_fee_adjustment),0) AS marketing_fee_adjustment,
      COALESCE(SUM(o.meal_voucher_amount),0) AS meal_voucher_amount,
      COALESCE(SUM(o.eco_contribution_refund),0) AS eco_contribution_refund
    FROM public.orders o
    WHERE o.payout_date IS NOT NULL
      AND EXTRACT(YEAR FROM o.payout_date) = p_year
      AND EXTRACT(MONTH FROM o.payout_date) = p_month
      AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
    GROUP BY o.restaurant_id, o.payout_date
  ),
  adj AS (
    SELECT
      a.restaurant_id AS rid,
      a.payout_date   AS pdate,
      COALESCE(SUM(a.amount),0) AS total_amount,
      COALESCE(SUM(a.amount) FILTER (WHERE a.category = 'eco_contribution' AND a.amount < 0),0) AS eco_charge,
      COALESCE(SUM(a.amount) FILTER (WHERE a.category = 'eco_contribution' AND a.amount >= 0),0) AS eco_refund,
      COALESCE(SUM(a.amount) FILTER (WHERE a.category = 'marketing_adjustment'),0) AS marketing_adj
    FROM public.payout_adjustments a
    WHERE a.payout_date IS NOT NULL
      AND a.restaurant_id IS NOT NULL
      AND EXTRACT(YEAR FROM a.payout_date) = p_year
      AND EXTRACT(MONTH FROM a.payout_date) = p_month
      AND (p_restaurant_ids IS NULL OR a.restaurant_id = ANY(p_restaurant_ids))
    GROUP BY a.restaurant_id, a.payout_date
  )
  SELECT
    COALESCE(o.rid, a.rid),
    COALESCE(o.pdate, a.pdate),
    COALESCE(o.sales_incl_vat,0), COALESCE(o.sales_excl_vat,0),
    COALESCE(o.refund_incl_vat,0), COALESCE(o.refund_excl_vat,0), COALESCE(o.vat_refund,0),
    COALESCE(o.item_promo_incl_vat,0), COALESCE(o.item_promo_excl_vat,0),
    COALESCE(o.uber_fee_after_promo_incl_vat,0), COALESCE(o.uber_fee_after_promo_excl_vat,0),
    COALESCE(o.uber_fee_before_promo_excl_vat,0), COALESCE(o.uber_fee_promo_excl_vat,0), COALESCE(o.vat_uber_fee,0),
    COALESCE(o.delivery_promo_incl_vat,0), COALESCE(o.delivery_promo_excl_vat,0),
    COALESCE(o.price_adjustment_incl_vat,0), COALESCE(o.price_adjustment_excl_vat,0),
    COALESCE(o.other_payments_incl_vat,0) + COALESCE(a.total_amount,0),
    COALESCE(o.net_payout,0) + COALESCE(a.total_amount,0),
    COALESCE(o.order_count,0),
    COALESCE(o.tips,0),
    COALESCE(o.marketing_fee_adjustment,0) + COALESCE(a.marketing_adj,0),
    COALESCE(o.meal_voucher_amount,0),
    COALESCE(o.eco_contribution_refund,0) + COALESCE(a.eco_refund,0),
    COALESCE(a.eco_charge,0)
  FROM ord o
  FULL OUTER JOIN adj a ON a.rid = o.rid AND a.pdate = o.pdate
  ORDER BY 2 ASC, 1 ASC;
$function$;

-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_yearly_payouts_detail(
  p_year integer,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  restaurant_id uuid, payout_date date,
  sales_incl_vat numeric, sales_excl_vat numeric,
  refund_incl_vat numeric, refund_excl_vat numeric, vat_refund numeric,
  item_promo_incl_vat numeric, item_promo_excl_vat numeric,
  uber_fee_after_promo_incl_vat numeric, uber_fee_after_promo_excl_vat numeric,
  uber_fee_before_promo_excl_vat numeric, uber_fee_promo_excl_vat numeric, vat_uber_fee numeric,
  delivery_promo_incl_vat numeric, delivery_promo_excl_vat numeric,
  price_adjustment_incl_vat numeric, price_adjustment_excl_vat numeric,
  other_payments_incl_vat numeric, net_payout numeric, order_count integer,
  tips numeric, marketing_fee_adjustment numeric, meal_voucher_amount numeric,
  eco_contribution_refund numeric, eco_contribution_charge numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH ord AS (
    SELECT
      o.restaurant_id AS rid,
      o.payout_date   AS pdate,
      COALESCE(SUM(o.sales_incl_vat),0) AS sales_incl_vat,
      COALESCE(SUM(o.sales_excl_vat),0) AS sales_excl_vat,
      COALESCE(SUM(o.refund_incl_vat),0) AS refund_incl_vat,
      COALESCE(SUM(o.refund_excl_vat),0) AS refund_excl_vat,
      COALESCE(SUM(COALESCE(o.vat_1_refund,0)+COALESCE(o.vat_2_refund,0)+COALESCE(o.vat_3_refund,0)),0) AS vat_refund,
      COALESCE(SUM(o.item_promo_incl_vat),0) AS item_promo_incl_vat,
      COALESCE(SUM(o.item_promo_excl_vat),0) AS item_promo_excl_vat,
      COALESCE(SUM(o.uber_fee_after_promo_incl_vat),0) AS uber_fee_after_promo_incl_vat,
      COALESCE(SUM(o.uber_fee_after_promo_excl_vat),0) AS uber_fee_after_promo_excl_vat,
      COALESCE(SUM(o.uber_fee_before_promo_excl_vat),0) AS uber_fee_before_promo_excl_vat,
      COALESCE(SUM(o.uber_fee_promo_excl_vat),0) AS uber_fee_promo_excl_vat,
      COALESCE(SUM(o.vat_uber_fee),0) AS vat_uber_fee,
      COALESCE(SUM(o.delivery_promo_incl_vat),0) AS delivery_promo_incl_vat,
      COALESCE(SUM(o.delivery_promo_excl_vat),0) AS delivery_promo_excl_vat,
      COALESCE(SUM(o.price_adjustment_incl_vat),0) AS price_adjustment_incl_vat,
      COALESCE(SUM(o.price_adjustment_excl_vat),0) AS price_adjustment_excl_vat,
      COALESCE(SUM(o.other_payments_incl_vat),0) AS other_payments_incl_vat,
      COALESCE(SUM(o.net_payout),0) AS net_payout,
      COUNT(*)::integer AS order_count,
      COALESCE(SUM(o.tip_amount),0) AS tips,
      COALESCE(SUM(o.marketing_fee_adjustment),0) AS marketing_fee_adjustment,
      COALESCE(SUM(o.meal_voucher_amount),0) AS meal_voucher_amount,
      COALESCE(SUM(o.eco_contribution_refund),0) AS eco_contribution_refund
    FROM public.orders o
    WHERE o.payout_date IS NOT NULL
      AND EXTRACT(YEAR FROM o.payout_date) = p_year
      AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
    GROUP BY o.restaurant_id, o.payout_date
  ),
  adj AS (
    SELECT
      a.restaurant_id AS rid,
      a.payout_date   AS pdate,
      COALESCE(SUM(a.amount),0) AS total_amount,
      COALESCE(SUM(a.amount) FILTER (WHERE a.category = 'eco_contribution' AND a.amount < 0),0) AS eco_charge,
      COALESCE(SUM(a.amount) FILTER (WHERE a.category = 'eco_contribution' AND a.amount >= 0),0) AS eco_refund,
      COALESCE(SUM(a.amount) FILTER (WHERE a.category = 'marketing_adjustment'),0) AS marketing_adj
    FROM public.payout_adjustments a
    WHERE a.payout_date IS NOT NULL
      AND a.restaurant_id IS NOT NULL
      AND EXTRACT(YEAR FROM a.payout_date) = p_year
      AND (p_restaurant_ids IS NULL OR a.restaurant_id = ANY(p_restaurant_ids))
    GROUP BY a.restaurant_id, a.payout_date
  )
  SELECT
    COALESCE(o.rid, a.rid),
    COALESCE(o.pdate, a.pdate),
    COALESCE(o.sales_incl_vat,0), COALESCE(o.sales_excl_vat,0),
    COALESCE(o.refund_incl_vat,0), COALESCE(o.refund_excl_vat,0), COALESCE(o.vat_refund,0),
    COALESCE(o.item_promo_incl_vat,0), COALESCE(o.item_promo_excl_vat,0),
    COALESCE(o.uber_fee_after_promo_incl_vat,0), COALESCE(o.uber_fee_after_promo_excl_vat,0),
    COALESCE(o.uber_fee_before_promo_excl_vat,0), COALESCE(o.uber_fee_promo_excl_vat,0), COALESCE(o.vat_uber_fee,0),
    COALESCE(o.delivery_promo_incl_vat,0), COALESCE(o.delivery_promo_excl_vat,0),
    COALESCE(o.price_adjustment_incl_vat,0), COALESCE(o.price_adjustment_excl_vat,0),
    COALESCE(o.other_payments_incl_vat,0) + COALESCE(a.total_amount,0),
    COALESCE(o.net_payout,0) + COALESCE(a.total_amount,0),
    COALESCE(o.order_count,0),
    COALESCE(o.tips,0),
    COALESCE(o.marketing_fee_adjustment,0) + COALESCE(a.marketing_adj,0),
    COALESCE(o.meal_voucher_amount,0),
    COALESCE(o.eco_contribution_refund,0) + COALESCE(a.eco_refund,0),
    COALESCE(a.eco_charge,0)
  FROM ord o
  FULL OUTER JOIN adj a ON a.rid = o.rid AND a.pdate = o.pdate
  ORDER BY 2 ASC, 1 ASC;
$function$;

-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_monthly_payouts_summary(
  p_year integer,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  restaurant_id uuid, month integer, year integer,
  sales_incl_vat numeric, refund_incl_vat numeric, item_promo_incl_vat numeric,
  uber_fee_incl_vat numeric, delivery_promo_incl_vat numeric,
  other_payments_incl_vat numeric, net_payout numeric, order_count bigint,
  tips numeric, marketing_fee_adjustment numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH ord AS (
    SELECT
      o.restaurant_id AS rid,
      EXTRACT(MONTH FROM o.payout_date)::integer AS m,
      COALESCE(SUM(o.sales_incl_vat),0) AS sales_incl_vat,
      COALESCE(SUM(o.refund_incl_vat),0) AS refund_incl_vat,
      COALESCE(SUM(o.item_promo_incl_vat),0) AS item_promo_incl_vat,
      COALESCE(SUM(o.uber_fee_after_promo_incl_vat),0) AS uber_fee_incl_vat,
      COALESCE(SUM(o.delivery_promo_incl_vat),0) AS delivery_promo_incl_vat,
      COALESCE(SUM(o.other_payments_incl_vat),0) AS other_payments_incl_vat,
      COALESCE(SUM(o.net_payout),0) AS net_payout,
      COUNT(*)::bigint AS order_count,
      COALESCE(SUM(o.tip_amount),0) AS tips,
      COALESCE(SUM(o.marketing_fee_adjustment),0) AS marketing_fee_adjustment
    FROM public.orders o
    WHERE o.payout_date IS NOT NULL
      AND EXTRACT(YEAR FROM o.payout_date) = p_year
      AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
    GROUP BY o.restaurant_id, EXTRACT(MONTH FROM o.payout_date)
  ),
  adj AS (
    SELECT
      a.restaurant_id AS rid,
      EXTRACT(MONTH FROM a.payout_date)::integer AS m,
      COALESCE(SUM(a.amount),0) AS total_amount,
      COALESCE(SUM(a.amount) FILTER (WHERE a.category = 'marketing_adjustment'),0) AS marketing_adj
    FROM public.payout_adjustments a
    WHERE a.payout_date IS NOT NULL
      AND a.restaurant_id IS NOT NULL
      AND EXTRACT(YEAR FROM a.payout_date) = p_year
      AND (p_restaurant_ids IS NULL OR a.restaurant_id = ANY(p_restaurant_ids))
    GROUP BY a.restaurant_id, EXTRACT(MONTH FROM a.payout_date)
  )
  SELECT
    COALESCE(o.rid, a.rid),
    COALESCE(o.m, a.m),
    p_year,
    COALESCE(o.sales_incl_vat,0),
    COALESCE(o.refund_incl_vat,0),
    COALESCE(o.item_promo_incl_vat,0),
    COALESCE(o.uber_fee_incl_vat,0),
    COALESCE(o.delivery_promo_incl_vat,0),
    COALESCE(o.other_payments_incl_vat,0) + COALESCE(a.total_amount,0),
    COALESCE(o.net_payout,0) + COALESCE(a.total_amount,0),
    COALESCE(o.order_count,0),
    COALESCE(o.tips,0),
    COALESCE(o.marketing_fee_adjustment,0) + COALESCE(a.marketing_adj,0)
  FROM ord o
  FULL OUTER JOIN adj a ON a.rid = o.rid AND a.m = o.m
  ORDER BY 2;
$function$;

-- ---------------------------------------------------------
-- Indicateur "consolidation en cours" : part des commandes déjà rattachées
-- à un cycle de versement Uber, par mois de commande.
CREATE OR REPLACE FUNCTION public.get_payouts_consolidation_status(
  p_year integer,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(month integer, orders_total bigint, orders_with_payout_date bigint, coverage_pct numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    EXTRACT(MONTH FROM (o.order_datetime AT TIME ZONE 'Europe/Paris'))::integer AS month,
    COUNT(*)::bigint AS orders_total,
    COUNT(o.payout_date)::bigint AS orders_with_payout_date,
    ROUND(100.0 * COUNT(o.payout_date) / NULLIF(COUNT(*),0), 1) AS coverage_pct
  FROM public.orders o
  WHERE EXTRACT(YEAR FROM (o.order_datetime AT TIME ZONE 'Europe/Paris')) = p_year
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  GROUP BY 1
  ORDER BY 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_monthly_payouts_detail(integer, integer, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_yearly_payouts_detail(integer, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_payouts_summary(integer, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payouts_consolidation_status(integer, uuid[]) TO authenticated, service_role;