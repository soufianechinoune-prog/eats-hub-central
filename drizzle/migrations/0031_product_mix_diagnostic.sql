CREATE OR REPLACE FUNCTION public.get_product_mix_diagnostic(p_channel text, p_restaurant_ids uuid[], p_launch date, p_days int)
RETURNS TABLE(product text, qty_before numeric, rev_before numeric, qty_after numeric, rev_after numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '60s'
AS $$
DECLARE b0 date := p_launch - p_days; e1 date := p_launch + p_days - 1;
BEGIN
  IF p_channel = 'cash' THEN
    RETURN QUERY
    SELECT p.product_name::text, (SUM(p.quantity) FILTER (WHERE p.ticket_date < p_launch))::numeric, (SUM(p.revenue) FILTER (WHERE p.ticket_date < p_launch))::numeric,
           (SUM(p.quantity) FILTER (WHERE p.ticket_date >= p_launch))::numeric, (SUM(p.revenue) FILTER (WHERE p.ticket_date >= p_launch))::numeric
    FROM caisse_daily_products p
    WHERE p.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(p.chain_id)
      AND p.ticket_date BETWEEN b0 AND e1 AND p.product_name IS NOT NULL
    GROUP BY p.product_name;
  ELSIF p_channel = 'uber' THEN
    RETURN QUERY
    SELECT i.item_title::text, (SUM(i.quantity) FILTER (WHERE x.d < p_launch))::numeric, (SUM(i.sales_incl_vat) FILTER (WHERE x.d < p_launch))::numeric,
           (SUM(i.quantity) FILTER (WHERE x.d >= p_launch))::numeric, (SUM(i.sales_incl_vat) FILTER (WHERE x.d >= p_launch))::numeric
    FROM order_items i
    JOIN orders o ON o.id = i.order_id
    JOIN restaurants r ON r.id = o.restaurant_id
    CROSS JOIN LATERAL (SELECT (o.order_datetime AT TIME ZONE 'Europe/Paris')::date d) x
    WHERE o.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
      AND o.order_datetime >= (b0::timestamp AT TIME ZONE 'Europe/Paris') AND o.order_datetime < ((e1 + 1)::timestamp AT TIME ZONE 'Europe/Paris')
      AND i.item_title IS NOT NULL
    GROUP BY i.item_title;
  ELSIF p_channel = 'chataigne' THEN
    RETURN QUERY
    SELECT i.item_name::text, (SUM(i.quantity) FILTER (WHERE x.d < p_launch))::numeric, (SUM(i.quantity*i.unit_price_amount) FILTER (WHERE x.d < p_launch))::numeric,
           (SUM(i.quantity) FILTER (WHERE x.d >= p_launch))::numeric, (SUM(i.quantity*i.unit_price_amount) FILTER (WHERE x.d >= p_launch))::numeric
    FROM chataigne_order_items i
    CROSS JOIN LATERAL (SELECT (i.order_datetime AT TIME ZONE 'Europe/Paris')::date d) x
    WHERE i.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(i.chain_id) AND COALESCE(i.depth,0) = 0
      AND i.order_datetime >= (b0::timestamp AT TIME ZONE 'Europe/Paris') AND i.order_datetime < ((e1 + 1)::timestamp AT TIME ZONE 'Europe/Paris')
      AND i.item_name IS NOT NULL
    GROUP BY i.item_name;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_product_mix_totals(p_channel text, p_restaurant_ids uuid[], p_launch date, p_days int)
RETURNS TABLE(tickets_before numeric, rev_before numeric, tickets_after numeric, rev_after numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '60s'
AS $$
DECLARE b0 date := p_launch - p_days; e1 date := p_launch + p_days - 1;
BEGIN
  IF p_channel = 'cash' THEN
    RETURN QUERY
    WITH s AS (
      SELECT d.date, SUM(COALESCE(d.revenue_ttc,0)) rev, SUM(COALESCE(d.order_count,0)) o
      FROM splash360_daily_sales d
      WHERE d.granularity='day' AND d.platform='global' AND d.restaurant_splash_id<>0
        AND d.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(d.chain_id)
        AND d.date BETWEEN b0 AND e1 GROUP BY d.date
    ), c AS (
      SELECT a.date, SUM(COALESCE(a.gross_order_value,0)) rev, SUM(COALESCE(a.order_count,0)) o
      FROM chataigne_daily_analytics a
      WHERE a.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(a.chain_id)
        AND a.date BETWEEN b0 AND e1 GROUP BY a.date
    ), n AS (SELECT s.date, GREATEST(s.rev-COALESCE(c.rev,0),0) rev, GREATEST(s.o-COALESCE(c.o,0),0) o FROM s LEFT JOIN c ON c.date=s.date)
    SELECT (SUM(n.o) FILTER (WHERE n.date < p_launch))::numeric, (SUM(n.rev) FILTER (WHERE n.date < p_launch))::numeric,
           (SUM(n.o) FILTER (WHERE n.date >= p_launch))::numeric, (SUM(n.rev) FILTER (WHERE n.date >= p_launch))::numeric FROM n;
  ELSIF p_channel = 'uber' THEN
    RETURN QUERY
    SELECT (COUNT(*) FILTER (WHERE x.d < p_launch))::numeric, (SUM(o.sales_incl_vat) FILTER (WHERE x.d < p_launch))::numeric,
           (COUNT(*) FILTER (WHERE x.d >= p_launch))::numeric, (SUM(o.sales_incl_vat) FILTER (WHERE x.d >= p_launch))::numeric
    FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
    CROSS JOIN LATERAL (SELECT (o.order_datetime AT TIME ZONE 'Europe/Paris')::date d) x
    WHERE o.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
      AND o.order_datetime >= (b0::timestamp AT TIME ZONE 'Europe/Paris') AND o.order_datetime < ((e1 + 1)::timestamp AT TIME ZONE 'Europe/Paris');
  ELSIF p_channel = 'chataigne' THEN
    RETURN QUERY
    SELECT (SUM(a.order_count) FILTER (WHERE a.date < p_launch))::numeric, (SUM(a.gross_order_value) FILTER (WHERE a.date < p_launch))::numeric,
           (SUM(a.order_count) FILTER (WHERE a.date >= p_launch))::numeric, (SUM(a.gross_order_value) FILTER (WHERE a.date >= p_launch))::numeric
    FROM chataigne_daily_analytics a
    WHERE a.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(a.chain_id) AND a.date BETWEEN b0 AND e1;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.get_product_mix_diagnostic(text, uuid[], date, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_mix_totals(text, uuid[], date, int) TO authenticated;