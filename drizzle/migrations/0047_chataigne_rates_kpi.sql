CREATE OR REPLACE FUNCTION public.get_chataigne_rates(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS TABLE(period text, total_orders bigint, cancelled bigint, discounts numeric, gross_before_discount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH bounds AS (
    SELECT p_start AS s, p_end AS e, 'current'::text AS period
    UNION ALL
    SELECT (p_start - (p_end - p_start + 1)), (p_start - 1), 'previous'
  )
  SELECT b.period,
    count(o.id),
    count(o.id) FILTER (WHERE o.status IN ('cancelled','delivery_failed')),
    coalesce(sum(o.discount_total_amount) FILTER (WHERE o.status = 'completed'),0),
    coalesce(sum(o.total_amount + coalesce(o.discount_total_amount,0)) FILTER (WHERE o.status = 'completed'),0)
  FROM bounds b
  LEFT JOIN public.chataigne_orders o
    ON (o.order_datetime AT TIME ZONE 'Europe/Paris')::date BETWEEN b.s AND b.e
   AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
   AND (public.is_super_admin() OR public.user_has_chain_access(o.chain_id))
  GROUP BY b.period;
$$;
GRANT EXECUTE ON FUNCTION public.get_chataigne_rates(date, date, uuid[]) TO authenticated;