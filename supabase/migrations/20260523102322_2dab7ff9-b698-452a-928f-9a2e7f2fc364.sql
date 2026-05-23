
-- 1. Cache table for refund daily aggregates
CREATE TABLE IF NOT EXISTS public.refund_daily_cache (
  restaurant_id uuid NOT NULL,
  date date NOT NULL,
  total_orders integer NOT NULL DEFAULT 0,
  refunded_orders integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, date)
);

CREATE INDEX IF NOT EXISTS idx_refund_daily_cache_date
  ON public.refund_daily_cache (date);

ALTER TABLE public.refund_daily_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chain scoped access on refund_daily_cache" ON public.refund_daily_cache;
CREATE POLICY "Chain scoped access on refund_daily_cache"
  ON public.refund_daily_cache
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
    OR restaurant_id IN (
      SELECT r.id FROM public.restaurants r
      WHERE public.user_has_chain_access(r.chain_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR restaurant_id IN (
      SELECT r.id FROM public.restaurants r
      WHERE public.user_has_chain_access(r.chain_id)
    )
  );

-- 2. Refresh function: recompute a date window and upsert into cache
CREATE OR REPLACE FUNCTION public.refresh_refund_daily_cache(
  p_start_date date,
  p_end_date date,
  p_restaurant_ids uuid[] DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $$
DECLARE
  v_ids uuid[];
  v_count integer;
BEGIN
  SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[])
    INTO v_ids
    FROM public.restaurants r
   WHERE (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
     AND (p_restaurant_ids IS NULL OR r.id = ANY(p_restaurant_ids));

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Delete the window we are about to recompute (so days with zero orders are not stale)
  DELETE FROM public.refund_daily_cache
   WHERE restaurant_id = ANY(v_ids)
     AND date BETWEEN p_start_date AND p_end_date;

  INSERT INTO public.refund_daily_cache (restaurant_id, date, total_orders, refunded_orders, computed_at)
  SELECT
    o.restaurant_id,
    ((o.order_datetime AT TIME ZONE 'Europe/Paris')::date) AS date,
    COUNT(*)::int AS total_orders,
    COUNT(*) FILTER (WHERE COALESCE(o.refund_incl_vat, 0) <> 0)::int AS refunded_orders,
    now()
  FROM public.orders o
  WHERE o.restaurant_id = ANY(v_ids)
    AND o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND o.order_datetime <  ((p_end_date + 1)::timestamp AT TIME ZONE 'Europe/Paris')
  GROUP BY o.restaurant_id, ((o.order_datetime AT TIME ZONE 'Europe/Paris')::date);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_refund_daily_cache(date, date, uuid[]) TO authenticated;

-- 3. Rewrite get_refunded_orders_count to merge cache (old) + live recompute (recent 15 days)
CREATE OR REPLACE FUNCTION public.get_refunded_orders_count(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
) RETURNS TABLE(restaurant_id uuid, refunded_orders bigint, total_orders bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '45s'
AS $$
DECLARE
  v_today    date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_live_from date := v_today - 15;  -- 14j Uber + 1j marge
  v_cache_end date;
  v_live_start date;
  v_live_end   date;
BEGIN
  -- Cache window = [p_start_date .. min(p_end_date, v_live_from - 1)]
  v_cache_end := LEAST(p_end_date, v_live_from - 1);
  -- Live window = [max(p_start_date, v_live_from) .. p_end_date]
  v_live_start := GREATEST(p_start_date, v_live_from);
  v_live_end   := p_end_date;

  RETURN QUERY
  WITH cache_part AS (
    SELECT c.restaurant_id,
           SUM(c.refunded_orders)::bigint AS refunded_orders,
           SUM(c.total_orders)::bigint    AS total_orders
      FROM public.refund_daily_cache c
     WHERE c.restaurant_id = ANY(p_restaurant_ids)
       AND p_start_date <= v_cache_end
       AND c.date BETWEEN p_start_date AND v_cache_end
     GROUP BY c.restaurant_id
  ),
  live_part AS (
    SELECT o.restaurant_id,
           COUNT(*) FILTER (WHERE COALESCE(o.refund_incl_vat, 0) <> 0)::bigint AS refunded_orders,
           COUNT(*)::bigint AS total_orders
      FROM public.orders o
     WHERE v_live_start <= v_live_end
       AND o.restaurant_id = ANY(p_restaurant_ids)
       AND o.order_datetime >= (v_live_start::timestamp AT TIME ZONE 'Europe/Paris')
       AND o.order_datetime <  ((v_live_end + 1)::timestamp AT TIME ZONE 'Europe/Paris')
     GROUP BY o.restaurant_id
  ),
  merged AS (
    SELECT restaurant_id, refunded_orders, total_orders FROM cache_part
    UNION ALL
    SELECT restaurant_id, refunded_orders, total_orders FROM live_part
  )
  SELECT m.restaurant_id,
         SUM(m.refunded_orders)::bigint,
         SUM(m.total_orders)::bigint
    FROM merged m
   GROUP BY m.restaurant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_refunded_orders_count(uuid[], date, date) TO authenticated;
