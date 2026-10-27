CREATE OR REPLACE FUNCTION public.ods_recompute_range(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start timestamptz := ((p_start::timestamp + interval '4 hours') AT TIME ZONE 'Europe/Paris');
  v_end timestamptz := ((p_end::timestamp + interval '1 day 4 hours') AT TIME ZONE 'Europe/Paris');
  v_ids uuid[] := COALESCE(p_restaurant_ids, (SELECT array_agg(id) FROM restaurants));
BEGIN
  DELETE FROM orders_daily_summary s
   WHERE s.day BETWEEN p_start AND p_end AND s.restaurant_id = ANY(v_ids);
  INSERT INTO orders_daily_summary(restaurant_id, day, sales_incl_vat, sales_incl_vat_pos, net_payout, item_promo_incl_vat_abs, meal_voucher, order_count, refreshed_at)
  SELECT ids.rid, ods_business_day(o.order_datetime),
    COALESCE(SUM(o.sales_incl_vat),0), COALESCE(SUM(GREATEST(o.sales_incl_vat,0)),0),
    COALESCE(SUM(o.net_payout),0), COALESCE(SUM(ABS(COALESCE(o.item_promo_incl_vat,0))),0),
    COALESCE(SUM(COALESCE(o.meal_voucher_amount,0)),0), COUNT(*), now()
  FROM unnest(v_ids) ids(rid)
  CROSS JOIN LATERAL (
    SELECT x.order_datetime, x.sales_incl_vat, x.net_payout, x.item_promo_incl_vat, x.meal_voucher_amount
    FROM orders x WHERE x.restaurant_id = ids.rid AND x.order_datetime >= v_start AND x.order_datetime < v_end
  ) o
  GROUP BY 1, 2;
END $$;
REVOKE ALL ON FUNCTION public.ods_recompute_range(date,date,uuid[]) FROM PUBLIC, anon, authenticated;