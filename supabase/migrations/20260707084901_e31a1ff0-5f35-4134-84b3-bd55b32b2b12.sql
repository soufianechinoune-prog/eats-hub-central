CREATE OR REPLACE FUNCTION public.get_weekly_uber_report(p_chain_id uuid, p_week_start date, p_week_end date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB; v_start TIMESTAMPTZ; v_end TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_has_chain_access(p_chain_id) THEN
    RAISE EXCEPTION 'Access denied for chain %', p_chain_id;
  END IF;
  v_start := (p_week_start::TIMESTAMP AT TIME ZONE 'Europe/Paris');
  v_end := ((p_week_end + 1)::TIMESTAMP AT TIME ZONE 'Europe/Paris');
  WITH base AS (
    SELECT o.id, o.restaurant_id, r.name AS restaurant_name,
      (o.order_datetime AT TIME ZONE 'Europe/Paris')::DATE AS local_date,
      COALESCE(o.sales_incl_vat, 0)::NUMERIC AS ca_brut_ttc,
      COALESCE(o.sales_excl_vat, 0)::NUMERIC AS ca_brut_ht,
      COALESCE(o.item_promo_incl_vat, 0)::NUMERIC AS promo_ttc,
      COALESCE(o.item_promo_excl_vat, 0)::NUMERIC AS promo_ht,
      COALESCE(o.uber_fee_after_promo_incl_vat, 0)::NUMERIC AS fee_ttc,
      COALESCE(o.uber_fee_after_promo_excl_vat, 0)::NUMERIC AS fee_ht,
      COALESCE(o.marketing_fee_incl_vat, 0)::NUMERIC AS mkt_ttc,
      COALESCE(o.marketing_fee_excl_vat, 0)::NUMERIC AS mkt_ht,
      COALESCE(o.uber_service_fee_incl_vat, 0)::NUMERIC AS svc_ttc,
      COALESCE(o.uber_service_fee_excl_vat, 0)::NUMERIC AS svc_ht,
      COALESCE(o.net_payout, 0)::NUMERIC AS payout,
      COALESCE(o.meal_voucher_amount, 0)::NUMERIC AS meal_voucher
    FROM public.orders o JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE r.chain_id = p_chain_id AND o.order_datetime >= v_start AND o.order_datetime < v_end
      AND COALESCE(o.status, '') NOT ILIKE '%cancel%'
  ),
  network_total AS (SELECT COUNT(*) AS orders_count, SUM(ca_brut_ttc) AS ca_brut_ttc, SUM(ca_brut_ht) AS ca_brut_ht, SUM(ca_brut_ttc - fee_ttc) AS ca_net_ttc, SUM(ca_brut_ht - fee_ht) AS ca_net_ht, SUM(fee_ttc) AS commission_uber, SUM(mkt_ttc) AS marketing_fee, SUM(svc_ttc) AS service_fee, SUM(payout + meal_voucher) AS payout_total FROM base),
  by_day AS (SELECT local_date, COUNT(*) AS orders_count, SUM(ca_brut_ttc) AS ca_brut_ttc, SUM(ca_brut_ht) AS ca_brut_ht, SUM(ca_brut_ttc - fee_ttc) AS ca_net_ttc, SUM(ca_brut_ht - fee_ht) AS ca_net_ht, SUM(fee_ttc) AS commission_uber, SUM(mkt_ttc) AS marketing_fee, SUM(svc_ttc) AS service_fee, SUM(payout + meal_voucher) AS payout_total FROM base GROUP BY local_date ORDER BY local_date),
  by_resto AS (SELECT restaurant_id, restaurant_name, COUNT(*) AS orders_count, SUM(ca_brut_ttc) AS ca_brut_ttc, SUM(ca_brut_ht) AS ca_brut_ht, SUM(ca_brut_ttc - fee_ttc) AS ca_net_ttc, SUM(ca_brut_ht - fee_ht) AS ca_net_ht, SUM(fee_ttc) AS commission_uber, SUM(mkt_ttc) AS marketing_fee, SUM(svc_ttc) AS service_fee, SUM(payout + meal_voucher) AS payout_total FROM base GROUP BY restaurant_id, restaurant_name ORDER BY restaurant_name),
  by_day_resto AS (SELECT local_date, restaurant_id, restaurant_name, COUNT(*) AS orders_count, SUM(ca_brut_ttc) AS ca_brut_ttc, SUM(ca_brut_ht) AS ca_brut_ht, SUM(ca_brut_ttc - fee_ttc) AS ca_net_ttc, SUM(ca_brut_ht - fee_ht) AS ca_net_ht, SUM(fee_ttc) AS commission_uber, SUM(mkt_ttc) AS marketing_fee, SUM(svc_ttc) AS service_fee, SUM(payout + meal_voucher) AS payout_total FROM base GROUP BY local_date, restaurant_id, restaurant_name ORDER BY local_date, restaurant_name)
  SELECT jsonb_build_object(
    'network', (SELECT to_jsonb(network_total) FROM network_total),
    'by_day', COALESCE((SELECT jsonb_agg(to_jsonb(by_day)) FROM by_day), '[]'::jsonb),
    'by_restaurant', COALESCE((SELECT jsonb_agg(to_jsonb(by_resto)) FROM by_resto), '[]'::jsonb),
    'by_day_restaurant', COALESCE((SELECT jsonb_agg(to_jsonb(by_day_resto)) FROM by_day_resto), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;