CREATE OR REPLACE FUNCTION public.get_weekly_uber_report(p_chain_id uuid, p_week_start date, p_week_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_has_chain_access(p_chain_id) THEN
    RAISE EXCEPTION 'Access denied for chain %', p_chain_id;
  END IF;

  v_start := (p_week_start::TIMESTAMP AT TIME ZONE 'Europe/Paris');
  v_end := ((p_week_end + 1)::TIMESTAMP AT TIME ZONE 'Europe/Paris');

  WITH base AS (
    SELECT
      o.restaurant_id,
      r.name AS restaurant_name,
      (o.order_datetime AT TIME ZONE 'Europe/Paris')::DATE AS local_date,
      COALESCE(o.sales_incl_vat, 0)::NUMERIC AS ca_brut_ttc,
      COALESCE(o.sales_excl_vat, 0)::NUMERIC AS ca_brut_ht,
      COALESCE(o.uber_fee_after_promo_incl_vat, 0)::NUMERIC AS commission_uber,
      COALESCE(o.marketing_fee_adjustment, 0)::NUMERIC AS marketing_fee,
      COALESCE(o.service_fee, 0)::NUMERIC AS service_fee,
      COALESCE(o.net_payout, 0)::NUMERIC AS net_payout,
      COALESCE(o.meal_voucher_amount, 0)::NUMERIC AS meal_voucher_amount
    FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE r.chain_id = p_chain_id
      AND o.order_datetime >= v_start
      AND o.order_datetime < v_end
      AND COALESCE(o.status, '') NOT ILIKE '%cancel%'
  ),
  network_total AS (
    SELECT
      COALESCE(SUM(ca_brut_ttc), 0) AS ca_brut_ttc,
      COALESCE(SUM(ca_brut_ht), 0) AS ca_brut_ht,
      COALESCE(SUM(commission_uber), 0) AS commission_uber,
      COALESCE(SUM(marketing_fee), 0) AS marketing_fee,
      COALESCE(SUM(service_fee), 0) AS service_fee,
      COALESCE(SUM(net_payout), 0) AS net_payout,
      COALESCE(SUM(meal_voucher_amount), 0) AS meal_voucher_amount
    FROM base
  ),
  by_day AS (
    SELECT
      local_date,
      COALESCE(SUM(ca_brut_ttc), 0) AS ca_brut_ttc,
      COALESCE(SUM(ca_brut_ht), 0) AS ca_brut_ht,
      COALESCE(SUM(commission_uber), 0) AS commission_uber,
      COALESCE(SUM(marketing_fee), 0) AS marketing_fee,
      COALESCE(SUM(service_fee), 0) AS service_fee,
      COALESCE(SUM(net_payout), 0) AS net_payout,
      COALESCE(SUM(meal_voucher_amount), 0) AS meal_voucher_amount
    FROM base
    GROUP BY local_date
    ORDER BY local_date
  ),
  by_resto AS (
    SELECT
      restaurant_id,
      restaurant_name,
      COALESCE(SUM(ca_brut_ttc), 0) AS ca_brut_ttc,
      COALESCE(SUM(ca_brut_ht), 0) AS ca_brut_ht,
      COALESCE(SUM(commission_uber), 0) AS commission_uber,
      COALESCE(SUM(marketing_fee), 0) AS marketing_fee,
      COALESCE(SUM(service_fee), 0) AS service_fee,
      COALESCE(SUM(net_payout), 0) AS net_payout,
      COALESCE(SUM(meal_voucher_amount), 0) AS meal_voucher_amount
    FROM base
    GROUP BY restaurant_id, restaurant_name
    ORDER BY restaurant_name
  ),
  by_day_resto AS (
    SELECT
      local_date,
      restaurant_id,
      restaurant_name,
      COALESCE(SUM(ca_brut_ttc), 0) AS ca_brut_ttc,
      COALESCE(SUM(ca_brut_ht), 0) AS ca_brut_ht,
      COALESCE(SUM(commission_uber), 0) AS commission_uber,
      COALESCE(SUM(marketing_fee), 0) AS marketing_fee,
      COALESCE(SUM(service_fee), 0) AS service_fee,
      COALESCE(SUM(net_payout), 0) AS net_payout,
      COALESCE(SUM(meal_voucher_amount), 0) AS meal_voucher_amount
    FROM base
    GROUP BY local_date, restaurant_id, restaurant_name
    ORDER BY local_date, restaurant_name
  )
  SELECT jsonb_build_object(
    'network', (SELECT to_jsonb(network_total) FROM network_total),
    'by_day', COALESCE((SELECT jsonb_agg(to_jsonb(by_day)) FROM by_day), '[]'::jsonb),
    'by_restaurant', COALESCE((SELECT jsonb_agg(to_jsonb(by_resto)) FROM by_resto), '[]'::jsonb),
    'by_day_restaurant', COALESCE((SELECT jsonb_agg(to_jsonb(by_day_resto)) FROM by_day_resto), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_weekly_uber_report(uuid, date, date) TO authenticated, service_role;