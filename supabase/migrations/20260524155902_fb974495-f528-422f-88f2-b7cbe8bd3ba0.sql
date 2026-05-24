
CREATE OR REPLACE FUNCTION public.get_orders_finance_detail(p_year integer, p_month integer, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(restaurant_id uuid, payout_date date, sales_incl_vat numeric, sales_excl_vat numeric, refund_incl_vat numeric, refund_excl_vat numeric, vat_refund numeric, item_promo_incl_vat numeric, item_promo_excl_vat numeric, uber_fee_after_promo_incl_vat numeric, uber_fee_after_promo_excl_vat numeric, uber_fee_before_promo_excl_vat numeric, uber_fee_promo_excl_vat numeric, vat_uber_fee numeric, delivery_promo_incl_vat numeric, delivery_promo_excl_vat numeric, price_adjustment_incl_vat numeric, price_adjustment_excl_vat numeric, other_payments_incl_vat numeric, net_payout numeric, order_count integer, tips numeric, marketing_fee_adjustment numeric, meal_voucher_amount numeric, eco_contribution_refund numeric, eco_contribution_charge numeric, refund_to_customer numeric, refund_uber_cancellation numeric, refund_net numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '45s'
AS $function$
DECLARE
  v_ids uuid[];
  v_start timestamptz := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_end   timestamptz := v_start + interval '1 month';
BEGIN
  SELECT COALESCE(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[])
    INTO v_ids
    FROM public.restaurants r
   WHERE (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
     AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ids.restaurant_id,
    ((ord.order_datetime AT TIME ZONE 'UTC')::date) AS payout_date,
    COALESCE(SUM(ord.sales_incl_vat), 0),
    COALESCE(SUM(ord.sales_excl_vat), 0),
    COALESCE(SUM(ord.refund_incl_vat), 0),
    COALESCE(SUM(ord.refund_excl_vat), 0),
    COALESCE(SUM(COALESCE(ord.vat_1_refund,0) + COALESCE(ord.vat_2_refund,0) + COALESCE(ord.vat_3_refund,0)), 0),
    COALESCE(SUM(ord.item_promo_incl_vat), 0),
    COALESCE(SUM(ord.item_promo_excl_vat), 0),
    COALESCE(SUM(ord.uber_fee_after_promo_incl_vat), 0),
    COALESCE(SUM(ord.uber_fee_after_promo_excl_vat), 0),
    COALESCE(SUM(ord.uber_fee_before_promo_excl_vat), 0),
    COALESCE(SUM(ord.uber_fee_promo_excl_vat), 0),
    COALESCE(SUM(ord.vat_uber_fee), 0),
    COALESCE(SUM(ord.delivery_promo_incl_vat), 0),
    COALESCE(SUM(ord.delivery_promo_excl_vat), 0),
    COALESCE(SUM(ord.price_adjustment_incl_vat), 0),
    COALESCE(SUM(ord.price_adjustment_excl_vat), 0),
    COALESCE(SUM(ord.other_payments_incl_vat), 0),
    COALESCE(SUM(ord.net_payout), 0),
    COUNT(*)::int,
    COALESCE(SUM(ord.tip_amount), 0),
    COALESCE(SUM(ord.marketing_fee_adjustment), 0),
    COALESCE(SUM(ord.meal_voucher_amount), 0),
    COALESCE(SUM(GREATEST(ord.eco_contribution_refund, 0)), 0),
    COALESCE(SUM(LEAST(ord.eco_contribution_refund, 0)), 0),
    -- Refund TO customer = real debits (negative refund_incl_vat)
    COALESCE(SUM(CASE WHEN ord.refund_incl_vat < 0 THEN ABS(ord.refund_incl_vat) ELSE 0 END), 0) AS refund_to_customer,
    -- Refund recovered from Uber = contested wins (new column) + legacy positive refund_incl_vat
    COALESCE(SUM(
      GREATEST(COALESCE(ord.refund_contested_incl_vat, 0), 0)
      + CASE WHEN ord.refund_incl_vat > 0 THEN ord.refund_incl_vat ELSE 0 END
    ), 0) AS refund_uber_cancellation,
    -- Net impact
    COALESCE(SUM(CASE WHEN ord.refund_incl_vat < 0 THEN ABS(ord.refund_incl_vat) ELSE 0 END), 0)
    - COALESCE(SUM(
        GREATEST(COALESCE(ord.refund_contested_incl_vat, 0), 0)
        + CASE WHEN ord.refund_incl_vat > 0 THEN ord.refund_incl_vat ELSE 0 END
      ), 0) AS refund_net
  FROM unnest(v_ids) AS ids(restaurant_id)
  CROSS JOIN LATERAL (
    SELECT
      o.order_datetime,
      o.sales_incl_vat, o.sales_excl_vat,
      o.refund_incl_vat, o.refund_excl_vat,
      o.refund_contested_incl_vat,
      o.vat_1_refund, o.vat_2_refund, o.vat_3_refund,
      o.item_promo_incl_vat, o.item_promo_excl_vat,
      o.uber_fee_after_promo_incl_vat, o.uber_fee_after_promo_excl_vat,
      o.uber_fee_before_promo_excl_vat, o.uber_fee_promo_excl_vat, o.vat_uber_fee,
      o.delivery_promo_incl_vat, o.delivery_promo_excl_vat,
      o.price_adjustment_incl_vat, o.price_adjustment_excl_vat,
      o.other_payments_incl_vat, o.net_payout,
      o.tip_amount, o.marketing_fee_adjustment, o.meal_voucher_amount,
      o.eco_contribution_refund
    FROM public.orders o
    WHERE o.restaurant_id = ids.restaurant_id
      AND o.order_datetime >= v_start
      AND o.order_datetime <  v_end
  ) ord
  GROUP BY ids.restaurant_id, ((ord.order_datetime AT TIME ZONE 'UTC')::date)
  ORDER BY ids.restaurant_id, ((ord.order_datetime AT TIME ZONE 'UTC')::date);
END;
$function$;
