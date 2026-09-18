-- Moyens de paiement caisse : agrégations anti-fan-out (tickets et règlements agrégés séparément).

CREATE OR REPLACE FUNCTION public.get_caisse_payment_breakdown(
  p_start date,
  p_end date,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  restaurant_id uuid,
  restaurant_name text,
  tickets bigint,
  days_covered bigint,
  revenue numeric,
  card_amount numeric,
  cash_amount numeric,
  tr_amount numeric,
  platform_amount numeric,
  other_amount numeric,
  paid_total numeric,
  tr_share numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $$
  with allowed as (
    select c.id from public.chains c
    where public.is_super_admin() or public.user_has_chain_access(c.id)
  ),
  t as (
    select
      s.restaurant_id,
      count(*)::bigint as n_tickets,
      count(distinct s.ticket_date)::bigint as n_days,
      sum(coalesce(s.total_amount, 0)) as revenue
    from public.splash_tickets s
    where s.ticket_date between p_start and p_end
      and (p_restaurant_ids is null or s.restaurant_id = any(p_restaurant_ids))
      and s.chain_id in (select id from allowed)
    group by 1
  ),
  p as (
    select
      pay.restaurant_id,
      sum(case when pay.category = 'Carte' then coalesce(pay.amount, 0) else 0 end) as card_amount,
      sum(case when pay.category = 'Espèces' then coalesce(pay.amount, 0) else 0 end) as cash_amount,
      sum(case when pay.category = 'Titres-resto' then coalesce(pay.amount, 0) else 0 end) as tr_amount,
      sum(case when pay.category = 'Plateforme' then coalesce(pay.amount, 0) else 0 end) as platform_amount,
      sum(case when pay.category = 'Autre' then coalesce(pay.amount, 0) else 0 end) as other_amount,
      sum(coalesce(pay.amount, 0)) as paid_total
    from public.splash_ticket_payments pay
    where pay.ticket_date between p_start and p_end
      and (p_restaurant_ids is null or pay.restaurant_id = any(p_restaurant_ids))
      and pay.chain_id in (select id from allowed)
    group by 1
  )
  select
    t.restaurant_id,
    r.name,
    t.n_tickets,
    t.n_days,
    round(t.revenue, 2),
    round(coalesce(p.card_amount, 0), 2),
    round(coalesce(p.cash_amount, 0), 2),
    round(coalesce(p.tr_amount, 0), 2),
    round(coalesce(p.platform_amount, 0), 2),
    round(coalesce(p.other_amount, 0), 2),
    round(coalesce(p.paid_total, 0), 2),
    round(100.0 * coalesce(p.tr_amount, 0) / nullif(coalesce(p.paid_total, 0), 0), 1)
  from t
  join public.restaurants r on r.id = t.restaurant_id
  left join p on p.restaurant_id = t.restaurant_id
  order by 5 desc nulls last;
$$;

CREATE OR REPLACE FUNCTION public.get_caisse_payment_brands(
  p_start date,
  p_end date,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  category text,
  brand text,
  payments bigint,
  amount numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $$
  with allowed as (
    select c.id from public.chains c
    where public.is_super_admin() or public.user_has_chain_access(c.id)
  )
  select
    pay.category,
    pay.brand,
    count(*)::bigint,
    round(sum(coalesce(pay.amount, 0)), 2)
  from public.splash_ticket_payments pay
  where pay.ticket_date between p_start and p_end
    and (p_restaurant_ids is null or pay.restaurant_id = any(p_restaurant_ids))
    and pay.chain_id in (select id from allowed)
  group by 1, 2
  order by 4 desc;
$$;

CREATE OR REPLACE FUNCTION public.get_caisse_payment_weekly(
  p_start date,
  p_end date,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  week_start date,
  card_amount numeric,
  cash_amount numeric,
  tr_amount numeric,
  platform_amount numeric,
  other_amount numeric,
  total_amount numeric,
  tr_share numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $$
  with allowed as (
    select c.id from public.chains c
    where public.is_super_admin() or public.user_has_chain_access(c.id)
  ),
  w as (
    select
      date_trunc('week', pay.ticket_date)::date as wk,
      sum(case when pay.category = 'Carte' then coalesce(pay.amount, 0) else 0 end) as card_amount,
      sum(case when pay.category = 'Espèces' then coalesce(pay.amount, 0) else 0 end) as cash_amount,
      sum(case when pay.category = 'Titres-resto' then coalesce(pay.amount, 0) else 0 end) as tr_amount,
      sum(case when pay.category = 'Plateforme' then coalesce(pay.amount, 0) else 0 end) as platform_amount,
      sum(case when pay.category = 'Autre' then coalesce(pay.amount, 0) else 0 end) as other_amount,
      sum(coalesce(pay.amount, 0)) as total_amount
    from public.splash_ticket_payments pay
    where pay.ticket_date between p_start and p_end
      and (p_restaurant_ids is null or pay.restaurant_id = any(p_restaurant_ids))
      and pay.chain_id in (select id from allowed)
    group by 1
  )
  select
    w.wk,
    round(w.card_amount, 2),
    round(w.cash_amount, 2),
    round(w.tr_amount, 2),
    round(w.platform_amount, 2),
    round(w.other_amount, 2),
    round(w.total_amount, 2),
    round(100.0 * w.tr_amount / nullif(w.total_amount, 0), 1)
  from w
  order by 1;
$$;

REVOKE ALL ON FUNCTION public.get_caisse_payment_breakdown(date, date, uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.get_caisse_payment_brands(date, date, uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.get_caisse_payment_weekly(date, date, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_caisse_payment_breakdown(date, date, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_caisse_payment_brands(date, date, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_caisse_payment_weekly(date, date, uuid[]) TO authenticated, service_role;
