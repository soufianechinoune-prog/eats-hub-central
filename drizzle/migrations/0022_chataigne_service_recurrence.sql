CREATE OR REPLACE FUNCTION public.get_chataigne_service_recurrence(
  p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' SET statement_timeout TO '30s'
AS $function$
  with allowed as (
    select c.id from public.chains c
    where public.is_super_admin() or public.user_has_chain_access(c.id)
  ),
  base as (
    select o.code_client,
      case when o.service_type = 'delivery' then 'delivery' else 'collection' end as svc,
      coalesce(o.total_amount,0) as total, o.order_datetime
    from public.chataigne_orders o
    where o.status = 'completed' and o.code_client is not null
      and (o.order_datetime at time zone 'Europe/Paris')::date between p_start and p_end
      and (p_restaurant_ids is null or o.restaurant_id = any(p_restaurant_ids))
      and o.chain_id in (select id from allowed)
  ),
  per_svc as (
    select svc, code_client, count(*) n, sum(total) ca from base group by 1,2
  ),
  mode_stats as (
    select svc, count(*) clients, count(*) filter (where n>=2) reguliers,
      sum(n) commandes, sum(ca) ca from per_svc group by 1
  ),
  per_client as (
    select code_client, count(*) n, sum(total) ca,
      count(*) filter (where svc='delivery') n_d,
      count(*) filter (where svc='collection') n_c,
      (array_agg(svc order by order_datetime))[1] as first_svc
    from base group by 1
  ),
  fam as (
    select *, case when n_d>0 and n_c>0 then 'both' when n_d>0 then 'delivery_only' else 'collection_only' end famille
    from per_client
  ),
  fam_stats as (
    select famille, count(*) clients, count(*) filter (where n>=2) reguliers,
      sum(n) commandes, sum(ca) ca from fam group by 1
  ),
  tot as (select count(*) clients from fam)
  select jsonb_build_object(
    'modes', coalesce((select jsonb_agg(jsonb_build_object(
      'mode', svc, 'clients', clients, 'reguliers', reguliers,
      'recurrence_pct', round(100.0*reguliers/nullif(clients,0),1),
      'commandes', commandes, 'freq', round(commandes::numeric/nullif(clients,0),2),
      'ca', round(ca,2), 'panier', round(ca/nullif(commandes,0),2))) from mode_stats),'[]'::jsonb),
    'familles', coalesce((select jsonb_agg(jsonb_build_object(
      'famille', famille, 'clients', f.clients,
      'part_pct', round(100.0*f.clients/nullif(t.clients,0),1),
      'reguliers', reguliers, 'recurrence_pct', round(100.0*reguliers/nullif(f.clients,0),1),
      'commandes', commandes, 'freq', round(commandes::numeric/nullif(f.clients,0),2),
      'ca', round(ca,2), 'panier', round(ca/nullif(commandes,0),2))) from fam_stats f, tot t),'[]'::jsonb),
    'parcours', (select jsonb_build_object(
      'recurrents', count(*),
      'delivery_to_collection', count(*) filter (where first_svc='delivery' and n_c>0),
      'collection_to_delivery', count(*) filter (where first_svc='collection' and n_d>0),
      'delivery_stay', count(*) filter (where first_svc='delivery' and n_c=0),
      'collection_stay', count(*) filter (where first_svc='collection' and n_d=0))
      from fam where n>=2),
    'clients_total', (select clients from tot)
  );
$function$;
REVOKE ALL ON FUNCTION public.get_chataigne_service_recurrence(date, date, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_chataigne_service_recurrence(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chataigne_service_recurrence(date, date, uuid[]) TO service_role;