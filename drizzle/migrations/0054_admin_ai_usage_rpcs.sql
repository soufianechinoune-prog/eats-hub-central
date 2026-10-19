create or replace function public.admin_ai_usage_kpis(p_month date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_start timestamptz := (date_trunc('month', p_month)::timestamp) at time zone 'Europe/Paris';
        v_end   timestamptz := ((date_trunc('month', p_month) + interval '1 month')::timestamp) at time zone 'Europe/Paris';
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return (select jsonb_build_object(
    'cost_usd',      coalesce(sum(cost_usd), 0),
    'questions',     count(*) filter (where status = 'success'),
    'active_users',  count(distinct user_id),
    'avg_latency_s', round(avg(duration_ms) filter (where status = 'success') / 1000.0, 2),
    'errors',        count(*) filter (where status = 'error'))
  from ai_usage_log where created_at >= v_start and created_at < v_end);
end $$;

create or replace function public.admin_ai_usage_by_chain(p_month date)
returns table(chain_id uuid, chain_name text, used_questions int, monthly_limit int,
              cost_usd numeric, avg_cost_per_question numeric, last_activity timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_start timestamptz := (date_trunc('month', p_month)::timestamp) at time zone 'Europe/Paris';
        v_end   timestamptz := ((date_trunc('month', p_month) + interval '1 month')::timestamp) at time zone 'Europe/Paris';
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query
  with l as (
    select l.chain_id, sum(l.cost_usd) cost, count(*) filter (where l.status='success') q, max(l.created_at) last_at
    from ai_usage_log l where l.created_at >= v_start and l.created_at < v_end group by l.chain_id)
  select c.id, c.name, coalesce(qt.used_questions, l.q::int, 0), coalesce(qt.monthly_limit_questions, 500),
         coalesce(l.cost, 0), case when l.q > 0 then round(l.cost / l.q, 4) end, l.last_at
  from chains c
  left join l on l.chain_id = c.id
  left join ai_quotas qt on qt.chain_id = c.id and qt.month = date_trunc('month', p_month)::date
  where l.chain_id is not null or qt.id is not null
  order by 5 desc;
end $$;

create or replace function public.admin_ai_usage_top_users(p_month date)
returns table(user_id uuid, email text, chain_id uuid, chain_name text,
              questions bigint, cost_usd numeric, avg_latency_s numeric)
language plpgsql stable security definer set search_path = public, auth as $$
declare v_start timestamptz := (date_trunc('month', p_month)::timestamp) at time zone 'Europe/Paris';
        v_end   timestamptz := ((date_trunc('month', p_month) + interval '1 month')::timestamp) at time zone 'Europe/Paris';
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query
  select l.user_id, u.email::text, l.chain_id, c.name,
         count(*) filter (where l.status='success'), coalesce(sum(l.cost_usd),0),
         round(avg(l.duration_ms) / 1000.0, 2)
  from ai_usage_log l
  left join auth.users u on u.id = l.user_id
  left join chains c on c.id = l.chain_id
  where l.created_at >= v_start and l.created_at < v_end
  group by l.user_id, u.email, l.chain_id, c.name
  order by 6 desc limit 20;
end $$;

create or replace function public.admin_ai_user_conversations(p_user_id uuid)
returns table(conversation_id uuid, title text, updated_at timestamptz, messages jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query
  select c.id, c.title, c.updated_at,
    (select coalesce(jsonb_agg(jsonb_build_object('role', m.role, 'content', m.content, 'at', m.created_at)
             order by m.created_at), '[]'::jsonb) from ai_messages m where m.conversation_id = c.id)
  from ai_conversations c
  where c.id in (select distinct l.conversation_id from ai_usage_log l
                 where l.user_id = p_user_id and l.conversation_id is not null)
  order by c.updated_at desc limit 50;
end $$;

create or replace function public.admin_ai_usage_daily(p_month date)
returns table(day date, cost_usd numeric, questions bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_m date := date_trunc('month', p_month)::date;
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query
  select d::date, coalesce(sum(l.cost_usd), 0), count(l.id) filter (where l.status='success')
  from generate_series(v_m, (v_m + interval '1 month' - interval '1 day')::date, interval '1 day') d
  left join ai_usage_log l on (l.created_at at time zone 'Europe/Paris')::date = d::date
  group by d order by d;
end $$;

create or replace function public.admin_ai_usage_errors()
returns table(created_at timestamptz, status text, chain_name text, email text,
              error_message text, duration_ms int)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query
  select l.created_at, l.status, c.name, u.email::text, l.error_message, l.duration_ms
  from ai_usage_log l
  left join chains c on c.id = l.chain_id
  left join auth.users u on u.id = l.user_id
  where l.status in ('error', 'quota_exceeded')
  order by l.created_at desc limit 50;
end $$;

revoke all on function public.admin_ai_usage_kpis(date), public.admin_ai_usage_by_chain(date),
  public.admin_ai_usage_top_users(date), public.admin_ai_user_conversations(uuid),
  public.admin_ai_usage_daily(date), public.admin_ai_usage_errors() from public, anon;
grant execute on function public.admin_ai_usage_kpis(date), public.admin_ai_usage_by_chain(date),
  public.admin_ai_usage_top_users(date), public.admin_ai_user_conversations(uuid),
  public.admin_ai_usage_daily(date), public.admin_ai_usage_errors() to authenticated;