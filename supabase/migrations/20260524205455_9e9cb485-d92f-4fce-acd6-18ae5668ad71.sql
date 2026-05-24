CREATE OR REPLACE FUNCTION public.get_refund_contestation_funnel(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  refunded_count bigint,
  refunded_amount numeric,
  contested_won_count bigint,
  contested_won_amount numeric,
  net_count bigint,
  net_amount numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      o.id,
      COALESCE(o.refund_incl_vat, 0) AS refund_incl_vat,
      COALESCE(o.refund_contested_incl_vat, 0) AS refund_contested_incl_vat
    FROM public.orders o
    WHERE o.restaurant_id = ANY(p_restaurant_ids)
      AND o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
      AND o.order_datetime <  ((p_end_date + 1)::timestamp AT TIME ZONE 'Europe/Paris')
  )
  SELECT
    COUNT(*) FILTER (WHERE refund_incl_vat < 0)::bigint                       AS refunded_count,
    ROUND(COALESCE(SUM(refund_incl_vat) FILTER (WHERE refund_incl_vat < 0), 0)::numeric, 2)             AS refunded_amount,
    COUNT(*) FILTER (WHERE refund_contested_incl_vat > 0)::bigint             AS contested_won_count,
    ROUND(COALESCE(SUM(refund_contested_incl_vat) FILTER (WHERE refund_contested_incl_vat > 0), 0)::numeric, 2) AS contested_won_amount,
    COUNT(*) FILTER (WHERE (refund_incl_vat + refund_contested_incl_vat) < 0)::bigint AS net_count,
    ROUND(COALESCE(SUM(refund_incl_vat + refund_contested_incl_vat) FILTER (WHERE refund_incl_vat < 0), 0)::numeric, 2) AS net_amount
  FROM base;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_refund_contestation_funnel(uuid[], date, date) TO authenticated;