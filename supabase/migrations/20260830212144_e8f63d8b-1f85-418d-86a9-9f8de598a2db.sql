CREATE OR REPLACE FUNCTION public.get_deliveroo_channel_summary(
  p_start_date date,
  p_end_date date,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $function$
WITH base AS (
  SELECT o.restaurant_id,
         (o.sent_at AT TIME ZONE 'Europe/Paris')::date AS day,
         o.subtotal,
         o.commission,
         o.net,
         o.status
  FROM public.deliveroo_sales_orders o
  WHERE (o.sent_at AT TIME ZONE 'Europe/Paris')::date BETWEEN p_start_date AND p_end_date
    AND o.restaurant_id IS NOT NULL
    AND o.status = 'Terminée'
    AND (public.is_super_admin() OR public.user_has_chain_access(o.chain_id))
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
),
totals AS (
  SELECT COALESCE(SUM(subtotal),0)::numeric AS revenue,
         COUNT(*)::bigint AS orders,
         COALESCE(SUM(commission),0)::numeric AS commission,
         COALESCE(SUM(net),0)::numeric AS net
  FROM base
),
daily AS (
  SELECT day,
         COALESCE(SUM(subtotal),0)::numeric AS revenue,
         COUNT(*)::bigint AS orders
  FROM base GROUP BY day ORDER BY day
),
per_resto AS (
  SELECT b.restaurant_id,
         r.name AS restaurant_name,
         COALESCE(SUM(b.subtotal),0)::numeric AS revenue,
         COUNT(*)::bigint AS orders,
         COALESCE(SUM(b.commission),0)::numeric AS commission,
         COALESCE(SUM(b.net),0)::numeric AS net
  FROM base b
  LEFT JOIN public.restaurants r ON r.id = b.restaurant_id
  GROUP BY b.restaurant_id, r.name
  ORDER BY 3 DESC
)
SELECT jsonb_build_object(
  'totals', (SELECT to_jsonb(t) FROM totals t),
  'daily', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM daily d), '[]'::jsonb),
  'restaurants', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM per_resto p), '[]'::jsonb)
);
$function$;

GRANT EXECUTE ON FUNCTION public.get_deliveroo_channel_summary(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_deliveroo_channel_summary(date, date, uuid[]) TO service_role;