-- Aggregated network cash revenue (current + N-1) for a given chain & period.
CREATE OR REPLACE FUNCTION public.get_network_cash_revenue(
  p_chain_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  -- current period
  total_global numeric,
  total_uber numeric,
  total_deliveroo numeric,
  total_global_orders bigint,
  total_uber_orders bigint,
  total_deliveroo_orders bigint,
  total_cash_ht numeric,
  total_cash_vat numeric,
  days_with_data integer,
  -- previous period (N-1, same calendar window shifted by 1 year)
  prev_total_cash numeric,
  prev_total_cash_orders bigint,
  prev_days_with_data integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cur AS (
    SELECT date, platform,
           SUM(COALESCE(revenue_ttc, 0)) AS ttc,
           SUM(COALESCE(revenue_ht, 0))  AS ht,
           SUM(COALESCE(vat_amount, 0))  AS vat,
           SUM(COALESCE(order_count, 0)) AS orders
    FROM public.splash360_daily_sales
    WHERE chain_id = p_chain_id
      AND granularity = 'day'
      AND restaurant_splash_id <> 0
      AND date BETWEEN p_start_date AND p_end_date
    GROUP BY date, platform
  ),
  prev AS (
    SELECT date, platform,
           SUM(COALESCE(revenue_ttc, 0)) AS ttc,
           SUM(COALESCE(order_count, 0)) AS orders
    FROM public.splash360_daily_sales
    WHERE chain_id = p_chain_id
      AND granularity = 'day'
      AND restaurant_splash_id <> 0
      AND date BETWEEN (p_start_date - INTERVAL '1 year')::date
                   AND (p_end_date   - INTERVAL '1 year')::date
    GROUP BY date, platform
  ),
  cur_day AS (
    SELECT date,
           SUM(ttc) FILTER (WHERE platform = 'global')     AS g_ttc,
           SUM(ttc) FILTER (WHERE platform = 'uber_eats')  AS u_ttc,
           SUM(ttc) FILTER (WHERE platform = 'deliveroo')  AS d_ttc,
           SUM(ht)  FILTER (WHERE platform = 'global')     AS g_ht,
           SUM(vat) FILTER (WHERE platform = 'global')     AS g_vat,
           SUM(orders) FILTER (WHERE platform = 'global')     AS g_o,
           SUM(orders) FILTER (WHERE platform = 'uber_eats')  AS u_o,
           SUM(orders) FILTER (WHERE platform = 'deliveroo')  AS d_o
    FROM cur
    GROUP BY date
  ),
  prev_day AS (
    SELECT date,
           SUM(ttc) FILTER (WHERE platform = 'global')     AS g_ttc,
           SUM(orders) FILTER (WHERE platform = 'global')     AS g_o
    FROM prev
    GROUP BY date
  ),
  cur_tot AS (
    SELECT
      COALESCE(SUM(g_ttc), 0)  AS total_global,
      COALESCE(SUM(u_ttc), 0)  AS total_uber,
      COALESCE(SUM(d_ttc), 0)  AS total_deliveroo,
      COALESCE(SUM(g_o), 0)::bigint   AS total_global_orders,
      COALESCE(SUM(u_o), 0)::bigint   AS total_uber_orders,
      COALESCE(SUM(d_o), 0)::bigint   AS total_deliveroo_orders,
      COALESCE(SUM(g_ht), 0)   AS total_cash_ht,
      COALESCE(SUM(g_vat), 0)  AS total_cash_vat,
      COUNT(*) FILTER (
        WHERE COALESCE(g_ttc,0) > 0 OR COALESCE(u_ttc,0) > 0 OR COALESCE(d_ttc,0) > 0
      )::int AS days_with_data
    FROM cur_day
  ),
  prev_tot AS (
    SELECT
      COALESCE(SUM(g_ttc), 0) AS prev_total_cash,
      COALESCE(SUM(g_o), 0)::bigint AS prev_total_cash_orders,
      COUNT(*) FILTER (WHERE COALESCE(g_ttc,0) > 0)::int AS prev_days_with_data
    FROM prev_day
  )
  SELECT
    c.total_global, c.total_uber, c.total_deliveroo,
    c.total_global_orders, c.total_uber_orders, c.total_deliveroo_orders,
    c.total_cash_ht, c.total_cash_vat, c.days_with_data,
    p.prev_total_cash, p.prev_total_cash_orders, p.prev_days_with_data
  FROM cur_tot c, prev_tot p;
$$;

REVOKE ALL ON FUNCTION public.get_network_cash_revenue(uuid, date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.get_network_cash_revenue(uuid, date, date) TO authenticated;


-- Per-restaurant cash revenue summary (current + N-1 via splash columns n1_*).
CREATE OR REPLACE FUNCTION public.get_restaurant_cash_revenue(
  p_chain_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  restaurant_id uuid,
  cash_revenue numeric,
  cash_revenue_ht numeric,
  cash_orders bigint,
  global_revenue numeric,
  prev_cash_revenue numeric,
  prev_cash_orders bigint,
  days_with_data integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH per_day AS (
    SELECT
      restaurant_id,
      date,
      SUM(COALESCE(revenue_ttc,0)) FILTER (WHERE platform = 'global')    AS g_ttc,
      SUM(COALESCE(revenue_ht,0))  FILTER (WHERE platform = 'global')    AS g_ht,
      SUM(COALESCE(order_count,0)) FILTER (WHERE platform = 'global')    AS g_o,
      SUM(COALESCE(revenue_ttc,0)) FILTER (WHERE platform = 'uber_eats') AS u_ttc,
      SUM(COALESCE(revenue_ttc,0)) FILTER (WHERE platform = 'deliveroo') AS d_ttc,
      SUM(COALESCE(n1_revenue_ttc,0)) FILTER (WHERE platform = 'global') AS n1_ttc,
      SUM(COALESCE(n1_order_count,0)) FILTER (WHERE platform = 'global') AS n1_o
    FROM public.splash360_daily_sales
    WHERE chain_id = p_chain_id
      AND granularity = 'day'
      AND restaurant_splash_id <> 0
      AND restaurant_id IS NOT NULL
      AND date BETWEEN p_start_date AND p_end_date
    GROUP BY restaurant_id, date
  )
  SELECT
    restaurant_id,
    COALESCE(SUM(g_ttc), 0)                                      AS cash_revenue,
    COALESCE(SUM(g_ht),  0)                                      AS cash_revenue_ht,
    COALESCE(SUM(g_o),   0)::bigint                              AS cash_orders,
    COALESCE(SUM(COALESCE(g_ttc,0) + COALESCE(u_ttc,0) + COALESCE(d_ttc,0)), 0) AS global_revenue,
    COALESCE(SUM(n1_ttc), 0)                                     AS prev_cash_revenue,
    COALESCE(SUM(n1_o),  0)::bigint                              AS prev_cash_orders,
    COUNT(*) FILTER (
      WHERE COALESCE(g_ttc,0) > 0 OR COALESCE(u_ttc,0) > 0 OR COALESCE(d_ttc,0) > 0
    )::int                                                       AS days_with_data
  FROM per_day
  GROUP BY restaurant_id;
$$;

REVOKE ALL ON FUNCTION public.get_restaurant_cash_revenue(uuid, date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.get_restaurant_cash_revenue(uuid, date, date) TO authenticated;