CREATE OR REPLACE FUNCTION public.get_product_mix_hourly_v2(p_chain_id uuid, p_restaurant_ids uuid[], p_from date, p_to date, p_products text[])
RETURNS TABLE(product text, hour int, qty numeric, revenue numeric, tickets bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.user_has_chain_access(p_chain_id) THEN RETURN; END IF;
  RETURN QUERY
  WITH t AS (
    SELECT ct.id, ct.ticket_date, extract(hour FROM ct.ticket_datetime AT TIME ZONE 'Europe/Paris')::int AS h
    FROM caisse_tickets ct
    WHERE ct.chain_id = p_chain_id AND ct.ticket_date BETWEEN p_from AND p_to
      AND ct.restaurant_id = ANY(p_restaurant_ids)
  ),
  tk AS (SELECT t.h, count(*) AS n FROM t GROUP BY t.h),
  pl AS (
    SELECT l.product_name AS pr, t.h, sum(l.quantity) AS q, sum(l.total_price) AS r
    FROM caisse_ticket_lines l JOIN t ON t.id = l.ticket_uuid AND t.ticket_date = l.ticket_date
    WHERE l.chain_id = p_chain_id AND l.ticket_date BETWEEN p_from AND p_to
      AND l.product_name = ANY(p_products)
    GROUP BY 1, 2
  ),
  tot AS (
    SELECT t.h, sum(l.quantity) AS q
    FROM caisse_ticket_lines l JOIN t ON t.id = l.ticket_uuid AND t.ticket_date = l.ticket_date
    WHERE l.chain_id = p_chain_id AND l.ticket_date BETWEEN p_from AND p_to
    GROUP BY t.h
  )
  SELECT '__all__'::text, tk.h, 0::numeric, 0::numeric, tk.n FROM tk
  UNION ALL
  SELECT '__total__'::text, tot.h, tot.q, 0::numeric, 0::bigint FROM tot
  UNION ALL
  SELECT pl.pr, pl.h, pl.q, pl.r, 0::bigint FROM pl;
END $$;
GRANT EXECUTE ON FUNCTION public.get_product_mix_hourly_v2(uuid, uuid[], date, date, text[]) TO authenticated;
COMMENT ON FUNCTION public.get_product_mix_hourly_v2(uuid, uuid[], date, date, text[]) IS 'Adds __total__ rows (all-product qty per hour) for network-base hourly profiles';