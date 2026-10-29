DROP FUNCTION IF EXISTS public.get_payouts_summary_range(uuid[], date, date);
CREATE FUNCTION public.get_payouts_summary_range(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
 RETURNS TABLE(restaurant_id uuid, payout_date date, sales_incl_vat numeric, net_payout numeric, order_count integer, meal_voucher_amount numeric)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  WITH allowed AS (
    SELECT r.id FROM public.restaurants r
    WHERE r.id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
  ),
  ord AS (
    SELECT o.restaurant_id rid, o.payout_date pdate,
      COALESCE(SUM(o.sales_incl_vat),0) s, COALESCE(SUM(o.net_payout),0) n, COUNT(*)::integer c,
      COALESCE(SUM(o.meal_voucher_amount),0) mv
    FROM public.orders o
    WHERE o.restaurant_id IN (SELECT id FROM allowed)
      AND o.payout_date >= p_start_date AND o.payout_date <= p_end_date
    GROUP BY 1,2
  ),
  adj AS (
    SELECT a.restaurant_id rid, a.payout_date pdate, COALESCE(SUM(a.amount),0) amt
    FROM public.payout_adjustments a
    WHERE a.restaurant_id IN (SELECT id FROM allowed)
      AND a.payout_date >= p_start_date AND a.payout_date <= p_end_date
    GROUP BY 1,2
  )
  SELECT COALESCE(o.rid,a.rid), COALESCE(o.pdate,a.pdate),
    COALESCE(o.s,0), COALESCE(o.n,0) + COALESCE(a.amt,0), COALESCE(o.c,0), COALESCE(o.mv,0)
  FROM ord o FULL OUTER JOIN adj a ON o.rid=a.rid AND o.pdate=a.pdate;
$function$;
GRANT EXECUTE ON FUNCTION public.get_payouts_summary_range(uuid[], date, date) TO authenticated;