CREATE INDEX IF NOT EXISTS idx_splash_webhook_events_stock ON public.splash_webhook_events (restaurant_id, received_at) WHERE event_type = 'stock' AND restaurant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_splash_stockouts(p_restaurant_ids uuid[], p_start date, p_end date)
RETURNS TABLE(restaurant_id uuid, restaurant_name text, item_id text, product_name text, category text,
  started_at timestamptz, ended_at timestamptz, duration_minutes numeric, is_ongoing boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '30s'
AS $$
  WITH ev AS (
    SELECT e.restaurant_id, e.chain_id, x->>'item_id' AS item_id, x->>'status' AS status, e.received_at
    FROM splash_webhook_events e, jsonb_array_elements(CASE WHEN jsonb_typeof(e.payload)='array' THEN e.payload ELSE '[]'::jsonb END) x
    WHERE e.event_type='stock' AND e.restaurant_id = ANY(p_restaurant_ids)
      AND public.user_has_chain_access(e.chain_id)
      AND e.received_at < ((p_end + 1)::timestamp AT TIME ZONE 'Europe/Paris')
  ), seq AS (
    SELECT ev.*, lag(status) OVER w AS prev_status,
      (SELECT min(n.received_at) FROM ev n WHERE n.restaurant_id=ev.restaurant_id AND n.item_id=ev.item_id
         AND n.status='available' AND n.received_at > ev.received_at) AS next_available
    FROM ev WINDOW w AS (PARTITION BY restaurant_id, item_id ORDER BY received_at)
  ), ep AS (
    SELECT restaurant_id, chain_id, item_id, received_at AS started_at, next_available AS ended_at
    FROM seq WHERE status='unavailable' AND prev_status IS DISTINCT FROM 'unavailable'
  ), names AS (
    SELECT DISTINCT ON (p.restaurant_id, p.product_ref) p.restaurant_id, p.product_ref, p.product_name, p.category
    FROM caisse_daily_products p
    WHERE p.restaurant_id = ANY(p_restaurant_ids) AND p.ticket_date >= current_date - 90
      AND p.product_ref IN (SELECT item_id FROM ep)
    ORDER BY p.restaurant_id, p.product_ref, p.ticket_date DESC
  ), anyname AS (
    SELECT DISTINCT ON (p.product_ref) p.product_ref, p.product_name, p.category
    FROM caisse_daily_products p
    WHERE p.ticket_date >= current_date - 30 AND p.product_ref IN (SELECT item_id FROM ep)
      AND p.chain_id IN (SELECT chain_id FROM ep)
    ORDER BY p.product_ref, p.ticket_date DESC
  )
  SELECT ep.restaurant_id, r.name, ep.item_id,
    COALESCE(n.product_name, a.product_name, ep.item_id), COALESCE(n.category, a.category),
    ep.started_at, ep.ended_at,
    round(extract(epoch FROM (COALESCE(ep.ended_at, now()) - ep.started_at))/60.0, 1),
    ep.ended_at IS NULL
  FROM ep JOIN restaurants r ON r.id=ep.restaurant_id
  LEFT JOIN names n ON n.restaurant_id=ep.restaurant_id AND n.product_ref=ep.item_id
  LEFT JOIN anyname a ON a.product_ref=ep.item_id
  WHERE COALESCE(ep.ended_at, now()) >= (p_start::timestamp AT TIME ZONE 'Europe/Paris')
  ORDER BY ep.started_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_splash_stockouts(uuid[], date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_splash_stockouts(uuid[], date, date) TO authenticated;