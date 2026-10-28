CREATE OR REPLACE FUNCTION public.get_chataigne_daily_by_service(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS TABLE(day date, service_type text, orders bigint, revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '30s'
AS $$
  select (o.order_datetime at time zone 'Europe/Paris')::date,
         case when o.service_type = 'delivery' then 'delivery' else 'collection' end,
         count(*)::bigint, round(sum(coalesce(o.total_amount,0)),2)
  from public.chataigne_orders o
  where o.order_datetime >= (p_start::timestamp at time zone 'Europe/Paris')
    and o.order_datetime < ((p_end + 1)::timestamp at time zone 'Europe/Paris')
    and o.status = 'completed'
    and (p_restaurant_ids is null or o.restaurant_id = any(p_restaurant_ids))
    and (public.is_super_admin() or public.user_has_chain_access(o.chain_id))
  group by 1,2 order by 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_chataigne_daily_by_service(date,date,uuid[]) TO authenticated;