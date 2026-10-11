CREATE OR REPLACE FUNCTION public.get_chataigne_overview(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(ca_brut numeric, commandes bigint, panier_moyen numeric, restos_actifs bigint, derniere_sync timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '15s'
AS $function$
  SELECT COALESCE(SUM(o.total_amount),0)::numeric,
         COUNT(*)::bigint,
         ROUND((SUM(o.total_amount)/NULLIF(COUNT(*),0))::numeric,2),
         COUNT(DISTINCT o.restaurant_id)::bigint,
         (SELECT MAX(finished_at) FROM public.chataigne_sync_runs WHERE status IN ('done','success'))
  FROM public.chataigne_orders o
  WHERE o.status = 'completed'
    AND (o.order_datetime AT TIME ZONE 'Europe/Paris')::date >= p_start
    AND (o.order_datetime AT TIME ZONE 'Europe/Paris')::date <= p_end
    AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
    AND (public.is_super_admin() OR public.user_has_chain_access(o.chain_id));
$function$;

GRANT EXECUTE ON FUNCTION public.get_chataigne_overview(date, date, uuid[]) TO authenticated;