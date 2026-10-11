CREATE OR REPLACE FUNCTION public.rebuild_chataigne_daily_from_orders(p_chain_id uuid, p_start date, p_end date, p_location_ids text[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE affected integer;
BEGIN
  IF p_chain_id IS NULL OR p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RAISE EXCEPTION 'Invalid rebuild scope';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_chain_id::text, 0));
  WITH daily AS (
    SELECT o.chataigne_location_id, (o.order_datetime AT TIME ZONE 'Europe/Paris')::date AS day,
      COUNT(*)::integer AS orders, SUM(COALESCE(o.total_amount,0)) AS gross,
      SUM(COALESCE(o.discount_total_amount,0)) AS discounts
    FROM public.chataigne_orders o
    WHERE o.chain_id = p_chain_id AND o.status = 'completed'
      AND o.order_datetime >= (p_start::timestamp AT TIME ZONE 'Europe/Paris')
      AND o.order_datetime < ((p_end + 1)::timestamp AT TIME ZONE 'Europe/Paris')
      AND (p_location_ids IS NULL OR o.chataigne_location_id = ANY(p_location_ids))
    GROUP BY 1,2
  ), keys AS (
    SELECT chataigne_location_id, day FROM daily
    UNION
    SELECT a.chataigne_location_id, a.date FROM public.chataigne_daily_analytics a
    WHERE a.chain_id = p_chain_id AND a.date BETWEEN p_start AND p_end AND a.service_type = 'all'
      AND (p_location_ids IS NULL OR a.chataigne_location_id = ANY(p_location_ids))
  )
  INSERT INTO public.chataigne_daily_analytics
    (chain_id, restaurant_id, chataigne_location_id, date, service_type, currency,
     gross_order_value, average_order_value, order_count, discount_amount, updated_at)
  SELECT p_chain_id, m.restaurant_id, k.chataigne_location_id, k.day, 'all', m.currency,
    ROUND(COALESCE(d.gross,0),2), ROUND(d.gross / NULLIF(d.orders,0),2),
    COALESCE(d.orders,0), ROUND(COALESCE(d.discounts,0),2), now()
  FROM keys k
  JOIN public.chataigne_location_mapping m ON m.chataigne_location_id = k.chataigne_location_id AND m.chain_id = p_chain_id
  LEFT JOIN daily d ON d.chataigne_location_id = k.chataigne_location_id AND d.day = k.day
  ON CONFLICT (chataigne_location_id,date,service_type) DO UPDATE SET
    chain_id = EXCLUDED.chain_id, restaurant_id = EXCLUDED.restaurant_id, currency = EXCLUDED.currency,
    gross_order_value = EXCLUDED.gross_order_value, average_order_value = EXCLUDED.average_order_value,
    order_count = EXCLUDED.order_count, discount_amount = EXCLUDED.discount_amount, updated_at = EXCLUDED.updated_at;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.rebuild_chataigne_daily_from_orders(uuid,date,date,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_chataigne_daily_from_orders(uuid,date,date,text[]) TO service_role;
COMMENT ON FUNCTION public.rebuild_chataigne_daily_from_orders(uuid,date,date,text[]) IS 'Service-only complete Paris calendar-day rebuild from completed orders, including zeroing previously populated days.';