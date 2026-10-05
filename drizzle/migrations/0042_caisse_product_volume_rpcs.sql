CREATE OR REPLACE FUNCTION public.get_caisse_product_volume_list(p_restaurant_ids uuid[], p_start date, p_end date)
RETURNS TABLE(product text, qty numeric, prev_qty numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '30s'
AS $$
  SELECT p.product_name,
    SUM(CASE WHEN p.ticket_date BETWEEN p_start AND p_end THEN p.quantity ELSE 0 END),
    SUM(CASE WHEN p.ticket_date < p_start THEN p.quantity ELSE 0 END)
  FROM caisse_daily_products p
  WHERE p.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(p.chain_id)
    AND (p.ticket_date BETWEEN p_start AND p_end OR p.ticket_date BETWEEN (p_start - interval '1 year')::date AND (p_end - interval '1 year')::date)
  GROUP BY p.product_name
  HAVING SUM(CASE WHEN p.ticket_date BETWEEN p_start AND p_end THEN p.quantity ELSE 0 END) > 0
  ORDER BY 2 DESC LIMIT 300;
$$;

CREATE OR REPLACE FUNCTION public.get_caisse_product_volume_daily(p_restaurant_ids uuid[], p_start date, p_end date, p_product text)
RETURNS TABLE(date date, qty numeric, prev_qty numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '30s'
AS $$
  WITH x AS (
    SELECT p.ticket_date d, SUM(p.quantity) q FROM caisse_daily_products p
    WHERE p.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(p.chain_id)
      AND p.product_name = p_product
      AND (p.ticket_date BETWEEN p_start AND p_end OR p.ticket_date BETWEEN (p_start - interval '1 year')::date AND (p_end - interval '1 year')::date)
    GROUP BY 1
  ), days AS (SELECT generate_series(p_start, p_end, interval '1 day')::date d)
  SELECT days.d, COALESCE(c.q,0), COALESCE(pr.q,0) FROM days
  LEFT JOIN x c ON c.d = days.d LEFT JOIN x pr ON pr.d = (days.d - interval '1 year')::date
  ORDER BY 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_caisse_product_volume_list(uuid[],date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_caisse_product_volume_daily(uuid[],date,date,text) TO authenticated;