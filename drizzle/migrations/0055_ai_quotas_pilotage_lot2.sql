alter table public.ai_quotas
  add column if not exists enabled boolean not null default true,
  add column if not exists model text not null default 'claude-sonnet-5-5';
alter table public.ai_quotas
  add constraint ai_quotas_model_check check (model in ('claude-sonnet-5-5','claude-haiku-5-5'));

create or replace function public._ensure_ai_quota_row(p_chain_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_month date := date_trunc('month', now() at time zone 'Europe/Paris')::date;
        v_id uuid; p record;
begin
  select id into v_id from ai_quotas where chain_id = p_chain_id and month = v_month;
  if v_id is not null then return v_id; end if;
  select enabled, monthly_limit_questions, model into p
    from ai_quotas where chain_id = p_chain_id and month < v_month
    order by month desc limit 1;
  insert into ai_quotas (chain_id, month, enabled, monthly_limit_questions, model)
  values (p_chain_id, v_month, coalesce(p.enabled, true),
          coalesce(p.monthly_limit_questions, 500), coalesce(p.model, 'claude-sonnet-5-5'))
  on conflict (chain_id, month) do nothing;
  select id into v_id from ai_quotas where chain_id = p_chain_id and month = v_month;
  return v_id;
end $$;
revoke all on function public._ensure_ai_quota_row(uuid) from public, anon, authenticated;

create or replace function public.get_or_create_monthly_ai_quota(p_chain_id uuid, p_default_limit integer default 500)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q record;
begin
  if not (is_super_admin() or user_has_chain_access(p_chain_id)) then
    raise exception 'Accès refusé pour cette enseigne';
  end if;
  select * into q from ai_quotas where id = _ensure_ai_quota_row(p_chain_id);
  return jsonb_build_object(
    'chain_id', q.chain_id, 'month', q.month,
    'enabled', q.enabled, 'model', q.model,
    'monthly_limit_questions', q.monthly_limit_questions,
    'used_questions', q.used_questions,
    'remaining_questions', greatest(0, q.monthly_limit_questions - q.used_questions),
    'budget_cap_usd', q.budget_cap_usd, 'used_cost_usd', q.used_cost_usd,
    'is_exceeded', q.used_questions >= q.monthly_limit_questions);
end $$;

create or replace function public.increment_ai_quota(p_chain_id uuid, p_cost_usd numeric default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q record;
begin
  update ai_quotas set used_questions = used_questions + 1,
                       used_cost_usd = used_cost_usd + coalesce(p_cost_usd, 0)
  where id = _ensure_ai_quota_row(p_chain_id)
  returning * into q;
  return jsonb_build_object('used_questions', q.used_questions,
    'monthly_limit_questions', q.monthly_limit_questions, 'used_cost_usd', q.used_cost_usd,
    'enabled', q.enabled, 'model', q.model);
end $$;

create or replace function public.admin_set_ai_quota(
  p_chain_id uuid, p_enabled boolean, p_monthly_limit integer, p_model text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q record;
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  if p_monthly_limit is null or p_monthly_limit < 100 or p_monthly_limit > 10000 then
    raise exception 'Limite mensuelle hors bornes (100–10000)';
  end if;
  if p_model not in ('claude-sonnet-5-5','claude-haiku-5-5') then
    raise exception 'Modèle inconnu';
  end if;
  update ai_quotas set enabled = p_enabled, monthly_limit_questions = p_monthly_limit, model = p_model
  where id = _ensure_ai_quota_row(p_chain_id)
  returning * into q;
  return to_jsonb(q);
end $$;
revoke all on function public.admin_set_ai_quota(uuid, boolean, integer, text) from public, anon;
grant execute on function public.admin_set_ai_quota(uuid, boolean, integer, text) to authenticated;

drop function if exists public.admin_ai_usage_by_chain(date);
create function public.admin_ai_usage_by_chain(p_month date)
returns table(chain_id uuid, chain_name text, used_questions int, monthly_limit int,
              cost_usd numeric, avg_cost_per_question numeric, last_activity timestamptz,
              enabled boolean, model text)
language plpgsql stable security definer set search_path = public as $$
declare v_start timestamptz := (date_trunc('month', p_month)::timestamp) at time zone 'Europe/Paris';
        v_end   timestamptz := ((date_trunc('month', p_month) + interval '1 month')::timestamp) at time zone 'Europe/Paris';
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query
  with l as (
    select l.chain_id, sum(l.cost_usd) cost, count(*) filter (where l.status='success') q, max(l.created_at) last_at
    from ai_usage_log l where l.created_at >= v_start and l.created_at < v_end group by l.chain_id),
  lastq as (
    select distinct on (a.chain_id) a.* from ai_quotas a
    where a.month <= date_trunc('month', p_month)::date
    order by a.chain_id, a.month desc)
  select c.id, c.name,
         case when lq.month = date_trunc('month', p_month)::date then lq.used_questions else coalesce(l.q::int, 0) end,
         coalesce(lq.monthly_limit_questions, 500),
         coalesce(l.cost, 0), case when l.q > 0 then round(l.cost / l.q, 4) end, l.last_at,
         coalesce(lq.enabled, true), coalesce(lq.model, 'claude-sonnet-5-5')
  from chains c
  left join l on l.chain_id = c.id
  left join lastq lq on lq.chain_id = c.id
  order by 5 desc, 2;
end $$;
revoke all on function public.admin_ai_usage_by_chain(date) from public, anon;
grant execute on function public.admin_ai_usage_by_chain(date) to authenticated;