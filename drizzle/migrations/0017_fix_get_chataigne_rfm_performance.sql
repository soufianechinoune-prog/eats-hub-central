create or replace function public.get_chataigne_rfm(p_start date, p_end date, p_restaurant_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '30s'
as $$
declare
  v_result jsonb;
begin
  with allowed as (
    select c.id from public.chains c
    where public.is_super_admin() or public.user_has_chain_access(c.id)
  ),
  ord as materialized (
    select o.code_client, o.order_datetime, coalesce(o.total_amount, 0) as total
    from public.chataigne_orders o
    where o.status = 'completed'
      and o.code_client is not null
      and (p_restaurant_ids is null or o.restaurant_id = any (p_restaurant_ids))
      and o.chain_id in (select id from allowed)
      and o.order_datetime < (p_end + 1)::timestamptz
  ),
  hist as materialized (
    select code_client, min(order_datetime) as first_dt, max(order_datetime) as last_dt
    from ord group by code_client
  ),
  percalc as materialized (
    select code_client, count(*)::int as nb, sum(total) as ca
    from ord
    where order_datetime >= p_start::timestamptz
    group by code_client
  ),
  per as materialized (
    select h.code_client, h.first_dt, h.last_dt,
      ceil(extract(epoch from ((p_end + 1)::timestamptz - h.last_dt)) / 86400)::int as recence,
      coalesce(p.nb, 0) as nb,
      coalesce(p.ca, 0) as ca
    from hist h
    left join percalc p using (code_client)
  ),
  seg as materialized (
    select *, case
        when nb = 0 then 'Inactifs (hors période)'
        when first_dt >= p_start::timestamptz and nb <= 2 then 'Nouveaux'
        when recence <= 14 and nb >= 4 then 'Champions'
        when recence <= 30 and nb >= 3 then 'Fidèles'
        when recence > 60 and nb >= 3 then 'À risque'
        when recence <= 60 then 'Occasionnels'
        else 'Dormants'
      end as segment
    from per
  ),
  segs as materialized (
    select
      segment,
      case segment
        when 'Champions' then 1 when 'Fidèles' then 2 when 'Nouveaux' then 3
        when 'Occasionnels' then 4 when 'À risque' then 5 when 'Dormants' then 6
        else 7 end as ord,
      count(*)::bigint as clients,
      sum(nb)::bigint as commandes,
      round(sum(ca)::numeric, 2) as ca,
      round(100.0 * sum(ca) / nullif((select sum(ca) from seg)::numeric, 0), 1) as ca_pct,
      round((sum(ca) / nullif(sum(nb), 0))::numeric, 2) as panier_moyen,
      round((sum(nb)::numeric / nullif(count(*), 0))::numeric, 2) as frequence_moy,
      round(avg(recence)::numeric, 1) as recence_moy
    from seg
    group by segment
  ),
  result as (
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'clients', (select count(*) from seg where nb > 0),
        'inactifs', (select count(*) from seg where nb = 0),
        'nouveaux', (select count(*) from seg where segment = 'Nouveaux'),
        'commandes', (select sum(nb) from seg),
        'ca', (select sum(ca) from seg),
        'panier_moyen', (select round((sum(ca) / nullif(sum(nb), 0))::numeric, 2) from seg),
        'frequence_moy', (select round(avg(nb)::numeric, 2) from seg where nb > 0),
        'recence_moy', (select round(avg(recence)::numeric, 1) from seg where nb > 0)
      ),
      'segments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'segment', s.segment,
          'clients', s.clients,
          'commandes', s.commandes,
          'ca', s.ca,
          'ca_pct', s.ca_pct,
          'panier_moyen', s.panier_moyen,
          'frequence_moy', s.frequence_moy,
          'recence_moy', s.recence_moy
        ) order by s.ord)
        from segs s
      ), '[]'::jsonb),
      'top_clients', coalesce((
        select jsonb_agg(jsonb_build_object(
          'client_key', substring(x.code_client, 1, 10) || '…',
          'segment', x.segment,
          'nb', x.nb,
          'ca', x.ca,
          'panier', x.panier,
          'recence', x.recence,
          'premier', x.first_dt,
          'dernier', x.last_dt
        ))
        from (
          select code_client, segment, nb, round(ca::numeric, 2) as ca,
                 round((ca / nullif(nb, 0))::numeric, 2) as panier,
                 recence, first_dt, last_dt
          from seg
          where nb > 0
          order by ca desc
          limit 40
        ) x
      ), '[]'::jsonb)
    ) as j
    from (select 1) dummy
  )
  select j into v_result from result;
  return v_result;
end;
$$;

grant execute on function public.get_chataigne_rfm(date, date, uuid[]) to authenticated;
grant execute on function public.get_chataigne_rfm_debug(date, date, uuid[]) to authenticated;
