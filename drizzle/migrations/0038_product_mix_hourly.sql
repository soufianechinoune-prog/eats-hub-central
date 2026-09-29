CREATE OR REPLACE FUNCTION public.get_product_mix_hourly(p_restaurant_ids uuid[], p_from date, p_to date, p_products text[])
RETURNS TABLE(product text, hour int, qty numeric, revenue numeric, tickets bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH allowed AS (
    SELECT r.id FROM restaurants r
    WHERE r.id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
  ),
  t AS (
    SELECT ct.id, ct.ticket_date, extract(hour FROM ct.ticket_datetime AT TIME ZONE 'Europe/Paris')::int AS h
    FROM caisse_tickets ct
    WHERE ct.restaurant_id IN (SELECT id FROM allowed)
      AND ct.ticket_date BETWEEN p_from AND p_to
  ),
  tk AS (SELECT h, count(*) AS n FROM t GROUP BY h),
  pl AS (
    SELECT l.product_name AS product, t.h, sum(l.quantity) AS qty, sum(l.total_price) AS revenue
    FROM caisse_ticket_lines l JOIN t ON t.id = l.ticket_uuid AND t.ticket_date = l.ticket_date
    WHERE l.restaurant_id IN (SELECT id FROM allowed)
      AND l.ticket_date BETWEEN p_from AND p_to
      AND l.product_name = ANY(p_products)
    GROUP BY 1, 2
  )
  SELECT '__all__'::text, tk.h, 0::numeric, 0::numeric, tk.n FROM tk
  UNION ALL
  SELECT pl.product, pl.h, pl.qty, pl.revenue, 0::bigint FROM pl;
$$;
GRANT EXECUTE ON FUNCTION public.get_product_mix_hourly(uuid[], date, date, text[]) TO authenticated;