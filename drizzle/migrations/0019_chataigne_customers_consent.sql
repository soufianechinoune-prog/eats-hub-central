-- Snapshot pseudonymisé des clients Chataigne (consentement marketing), aucune PII
create table if not exists public.chataigne_customers (
  code_client text primary key,
  chain_id uuid not null references public.chains(id) on delete cascade,
  marketing_consent_status text,
  marketing_consent_changed_at timestamptz,
  completed_orders_count integer,
  language text,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_chataigne_customers_chain_consent
  on public.chataigne_customers (chain_id, marketing_consent_status);

grant select on public.chataigne_customers to authenticated;
grant all on public.chataigne_customers to service_role;

alter table public.chataigne_customers enable row level security;

drop policy if exists "chataigne_customers_select" on public.chataigne_customers;
create policy "chataigne_customers_select"
on public.chataigne_customers
for select
to authenticated
using (public.is_super_admin() or public.user_has_chain_access(chain_id));

-- Audiences marketing par segment RFM x consentement (anti fan-out, un seul passage)
create or replace function public.get_chataigne_consent_audience(
  p_start date,
  p_end date,
  p_restaurant_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
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
    select p.*,
      case
        when p.nb = 0 then 'Inactifs (hors période)'
        when p.first_dt >= p_start::timestamptz and p.nb <= 2 then 'Nouveaux'
        when p.recence <= 14 and p.nb >= 4 then 'Champions'
        when p.recence <= 30 and p.nb >= 3 then 'Fidèles'
        when p.recence > 60 and p.nb >= 3 then 'À risque'
        when p.recence <= 60 then 'Occasionnels'
        else 'Dormants'
      end as segment,
      case
        when cu.marketing_consent_status is null then 'inconnu'
        when cu.marketing_consent_status = 'opted_in' then 'opted_in'
        when cu.marketing_consent_status = 'opted_out' then 'opted_out'
        else 'inconnu'
      end as consent
    from per p
    left join public.chataigne_customers cu on cu.code_client = p.code_client
  ),
  segs as materialized (
    select
      segment,
      case segment
        when 'Champions' then 1 when 'Fidèles' then 2 when 'Nouveaux' then 3
        when 'Occasionnels' then 4 when 'À risque' then 5 when 'Dormants' then 6
        else 7 end as ord,
      count(*)::bigint as clients,
      count(*) filter (where consent = 'opted_in')::bigint as opted_in,
      count(*) filter (where consent = 'opted_out')::bigint as opted_out,
      count(*) filter (where consent = 'inconnu')::bigint as inconnu,
      round(sum(ca)::numeric, 2) as ca,
      round(sum(ca) filter (where consent = 'opted_in')::numeric, 2) as ca_opted_in,
      round((sum(ca) / nullif(sum(nb), 0))::numeric, 2) as panier_moyen
    from seg
    group by segment
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'clients', (select count(*) from seg),
      'actifs', (select count(*) from seg where nb > 0),
      'opted_in', (select count(*) from seg where consent = 'opted_in'),
      'opted_out', (select count(*) from seg where consent = 'opted_out'),
      'inconnu', (select count(*) from seg where consent = 'inconnu'),
      'joignables_actifs', (select count(*) from seg where consent = 'opted_in' and nb > 0),
      'ca_opted_in', (select round(sum(ca)::numeric, 2) from seg where consent = 'opted_in'),
      'couverture_pct', (select round(100.0 * count(*) filter (where consent <> 'inconnu') / nullif(count(*), 0), 1) from seg),
      'snapshot_at', (select max(synced_at) from public.chataigne_customers cu
                      where public.is_super_admin() or public.user_has_chain_access(cu.chain_id))
    ),
    'segments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'segment', s.segment,
        'clients', s.clients,
        'opted_in', s.opted_in,
        'opted_out', s.opted_out,
        'inconnu', s.inconnu,
        'ca', s.ca,
        'ca_opted_in', s.ca_opted_in,
        'panier_moyen', s.panier_moyen
      ) order by s.ord)
      from segs s
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_chataigne_consent_audience(date, date, uuid[]) from public;
grant execute on function public.get_chataigne_consent_audience(date, date, uuid[]) to authenticated;
