-- RPC 1: Calendar de répartition data_source par mois pour un restaurant
CREATE OR REPLACE FUNCTION public.get_restaurant_data_source_calendar(
  p_restaurant_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  month_start date,
  api_count bigint,
  csv_count bigint,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', p_start_date)::date,
      date_trunc('month', p_end_date)::date,
      interval '1 month'
    )::date AS m
  )
  SELECT
    m.m AS month_start,
    COALESCE(SUM(CASE WHEN o.data_source = 'uber_api' THEN 1 ELSE 0 END), 0)::bigint AS api_count,
    COALESCE(SUM(CASE WHEN o.data_source IS NULL OR o.data_source <> 'uber_api' THEN 1 ELSE 0 END), 0)::bigint AS csv_count,
    COALESCE(COUNT(o.id), 0)::bigint AS total_count
  FROM months m
  LEFT JOIN orders o
    ON o.restaurant_id = p_restaurant_id
   AND o.order_datetime >= m.m
   AND o.order_datetime < (m.m + interval '1 month')
  GROUP BY m.m
  ORDER BY m.m;
$$;

GRANT EXECUTE ON FUNCTION public.get_restaurant_data_source_calendar(uuid, date, date) TO authenticated;

-- RPC 2: Calendar agrégé pour TOUS les restaurants (pour la liste de gauche)
CREATE OR REPLACE FUNCTION public.get_restaurants_data_source_summary(
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  restaurant_id uuid,
  restaurant_name text,
  uber_store_id text,
  chain_id uuid,
  api_count bigint,
  csv_count bigint,
  months_with_data integer,
  months_csv_only integer,
  months_api_only integer,
  months_mixed integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH per_month AS (
    SELECT
      r.id AS restaurant_id,
      r.name AS restaurant_name,
      r.uber_store_id,
      r.chain_id,
      date_trunc('month', o.order_datetime AT TIME ZONE 'Europe/Paris')::date AS month_start,
      SUM(CASE WHEN o.data_source = 'uber_api' THEN 1 ELSE 0 END) AS api_n,
      SUM(CASE WHEN o.data_source IS NULL OR o.data_source <> 'uber_api' THEN 1 ELSE 0 END) AS csv_n
    FROM restaurants r
    LEFT JOIN orders o
      ON o.restaurant_id = r.id
     AND o.order_datetime >= p_start_date
     AND o.order_datetime < (p_end_date + interval '1 day')
    WHERE r.uber_store_id IS NOT NULL AND r.uber_store_id <> ''
    GROUP BY r.id, r.name, r.uber_store_id, r.chain_id, date_trunc('month', o.order_datetime AT TIME ZONE 'Europe/Paris')
  )
  SELECT
    pm.restaurant_id,
    pm.restaurant_name,
    pm.uber_store_id,
    pm.chain_id,
    COALESCE(SUM(pm.api_n), 0)::bigint AS api_count,
    COALESCE(SUM(pm.csv_n), 0)::bigint AS csv_count,
    COUNT(pm.month_start) FILTER (WHERE pm.month_start IS NOT NULL)::int AS months_with_data,
    COUNT(*) FILTER (WHERE pm.month_start IS NOT NULL AND pm.api_n = 0 AND pm.csv_n > 0)::int AS months_csv_only,
    COUNT(*) FILTER (WHERE pm.month_start IS NOT NULL AND pm.api_n > 0 AND pm.csv_n = 0)::int AS months_api_only,
    COUNT(*) FILTER (WHERE pm.month_start IS NOT NULL AND pm.api_n > 0 AND pm.csv_n > 0)::int AS months_mixed
  FROM per_month pm
  GROUP BY pm.restaurant_id, pm.restaurant_name, pm.uber_store_id, pm.chain_id
  ORDER BY months_csv_only DESC, restaurant_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_restaurants_data_source_summary(date, date) TO authenticated;

-- RPC 3: Enqueue ORDER_HISTORY_REPORT backfill jobs (vague 6) for selected months
CREATE OR REPLACE FUNCTION public.enqueue_order_history_backfill(
  p_restaurant_id uuid,
  p_months date[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_resto record;
  v_month date;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden: super admin only';
  END IF;

  SELECT id, name, uber_store_id INTO v_resto
  FROM restaurants WHERE id = p_restaurant_id;

  IF v_resto.id IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;
  IF v_resto.uber_store_id IS NULL OR v_resto.uber_store_id = '' THEN
    RAISE EXCEPTION 'Restaurant has no uber_store_id';
  END IF;

  FOREACH v_month IN ARRAY p_months LOOP
    INSERT INTO backfill_jobs (
      restaurant_id, restaurant_name, uber_store_id,
      month_start, month_end,
      status, attempts, report_type, vague
    ) VALUES (
      v_resto.id, v_resto.name, v_resto.uber_store_id,
      date_trunc('month', v_month)::date,
      (date_trunc('month', v_month) + interval '1 month - 1 day')::date,
      'pending', 0, 'ORDER_HISTORY_REPORT', 6
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_order_history_backfill(uuid, date[]) TO authenticated;