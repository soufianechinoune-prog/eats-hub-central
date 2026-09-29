CREATE OR REPLACE FUNCTION public.get_product_mix_daily(p_channel text, p_restaurant_ids uuid[], p_launch date, p_days integer, p_products text[])
RETURNS TABLE(d date, rev_all numeric, qty_all numeric, rev_sel numeric, qty_sel numeric, tickets numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '60s'
AS $function$
DECLARE b0 date := p_launch - p_days; e1 date := p_launch + p_days - 1; sel text[] := COALESCE(p_products, '{}');
BEGIN
  IF p_channel = 'cash' THEN
    -- Panier moyen global = CA et tickets de la MÊME source (Splash net Châtaigne).
    -- qty_all = volume total d'articles (pr.qa), PAS le CA produits (pr.ra).
    RETURN QUERY
    WITH s AS (
      SELECT x.date dd, SUM(COALESCE(x.revenue_ttc,0))::numeric rev, SUM(COALESCE(x.order_count,0))::numeric o
      FROM splash360_daily_sales x
      WHERE x.granularity='day' AND x.platform='global' AND x.restaurant_splash_id<>0
        AND x.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(x.chain_id)
        AND x.date BETWEEN b0 AND e1 GROUP BY x.date
    ), c AS (
      SELECT a.date dd, SUM(COALESCE(a.gross_order_value,0))::numeric rev, SUM(COALESCE(a.order_count,0))::numeric o
      FROM chataigne_daily_analytics a
      WHERE a.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(a.chain_id)
        AND a.date BETWEEN b0 AND e1 GROUP BY a.date
    ), n AS (
      SELECT s.dd, GREATEST(s.rev - COALESCE(c.rev,0), 0) rev, GREATEST(s.o - COALESCE(c.o,0), 0) o
      FROM s LEFT JOIN c ON c.dd = s.dd
    ), pr AS (
      SELECT p.ticket_date dd, SUM(p.revenue)::numeric ra, SUM(p.quantity)::numeric qa,
             COALESCE(SUM(p.revenue) FILTER (WHERE p.product_name = ANY(sel)),0)::numeric rs,
             COALESCE(SUM(p.quantity) FILTER (WHERE p.product_name = ANY(sel)),0)::numeric qs
      FROM caisse_daily_products p
      WHERE p.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(p.chain_id)
        AND p.ticket_date BETWEEN b0 AND e1 AND p.product_name IS NOT NULL
      GROUP BY p.ticket_date
    )
    SELECT n.dd, n.rev, COALESCE(pr.qa,0), COALESCE(pr.rs,0), COALESCE(pr.qs,0), n.o
    FROM n LEFT JOIN pr ON pr.dd = n.dd
    ORDER BY n.dd;
  ELSIF p_channel = 'uber' THEN
    RETURN QUERY
    SELECT x.dd, SUM(i.sales_incl_vat)::numeric, SUM(i.quantity)::numeric,
           COALESCE(SUM(i.sales_incl_vat) FILTER (WHERE i.item_title = ANY(sel)),0)::numeric,
           COALESCE(SUM(i.quantity) FILTER (WHERE i.item_title = ANY(sel)),0)::numeric,
           COUNT(DISTINCT o.id)::numeric
    FROM order_items i JOIN orders o ON o.id = i.order_id JOIN restaurants r ON r.id = o.restaurant_id
    CROSS JOIN LATERAL (SELECT (o.order_datetime AT TIME ZONE 'Europe/Paris')::date dd) x
    WHERE o.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
      AND o.order_datetime >= (b0::timestamp AT TIME ZONE 'Europe/Paris') AND o.order_datetime < ((e1 + 1)::timestamp AT TIME ZONE 'Europe/Paris')
      AND i.item_title IS NOT NULL
    GROUP BY x.dd ORDER BY x.dd;
  ELSIF p_channel = 'chataigne' THEN
    RETURN QUERY
    SELECT x.dd, SUM(i.quantity*i.unit_price_amount)::numeric, SUM(i.quantity)::numeric,
           COALESCE(SUM(i.quantity*i.unit_price_amount) FILTER (WHERE i.item_name = ANY(sel)),0)::numeric,
           COALESCE(SUM(i.quantity) FILTER (WHERE i.item_name = ANY(sel)),0)::numeric,
           COUNT(DISTINCT i.chataigne_order_id)::numeric
    FROM chataigne_order_items i
    CROSS JOIN LATERAL (SELECT (i.order_datetime AT TIME ZONE 'Europe/Paris')::date dd) x
    WHERE i.restaurant_id = ANY(p_restaurant_ids) AND public.user_has_chain_access(i.chain_id) AND COALESCE(i.depth,0) = 0
      AND i.order_datetime >= (b0::timestamp AT TIME ZONE 'Europe/Paris') AND i.order_datetime < ((e1 + 1)::timestamp AT TIME ZONE 'Europe/Paris')
      AND i.item_name IS NOT NULL
    GROUP BY x.dd ORDER BY x.dd;
  END IF;
END $function$;
GRANT EXECUTE ON FUNCTION public.get_product_mix_daily(text, uuid[], date, integer, text[]) TO authenticated;