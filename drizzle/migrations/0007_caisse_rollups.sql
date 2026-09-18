-- 1. Rollup tables (grain: restaurant x day)

CREATE TABLE public.caisse_daily_tickets (
  restaurant_id uuid NOT NULL,
  chain_id uuid NOT NULL,
  ticket_date date NOT NULL,
  tickets bigint NOT NULL DEFAULT 0,
  revenue_ttc numeric NOT NULL DEFAULT 0,
  revenue_ht numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  tickets_onsite bigint NOT NULL DEFAULT 0,
  tickets_takeaway bigint NOT NULL DEFAULT 0,
  tickets_delivery bigint NOT NULL DEFAULT 0,
  revenue_onsite numeric NOT NULL DEFAULT 0,
  revenue_takeaway numeric NOT NULL DEFAULT 0,
  revenue_delivery numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, ticket_date)
);

CREATE TABLE public.caisse_daily_payments (
  restaurant_id uuid NOT NULL,
  chain_id uuid NOT NULL,
  ticket_date date NOT NULL,
  category text NOT NULL,
  brand text NOT NULL DEFAULT '',
  payments bigint NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, ticket_date, category, brand)
);

CREATE TABLE public.caisse_daily_products (
  restaurant_id uuid NOT NULL,
  chain_id uuid NOT NULL,
  ticket_date date NOT NULL,
  product_key text NOT NULL,
  product_name text NOT NULL DEFAULT '',
  product_ref text,
  category text,
  quantity numeric NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, ticket_date, product_key)
);

-- Attachement: compteur de tickets DISTINCTS par categorie (jamais sommable depuis products)
CREATE TABLE public.caisse_daily_attachment (
  restaurant_id uuid NOT NULL,
  chain_id uuid NOT NULL,
  ticket_date date NOT NULL,
  category text NOT NULL,
  tickets_with_category bigint NOT NULL DEFAULT 0,
  tickets_total bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, ticket_date, category)
);

CREATE INDEX caisse_daily_tickets_chain_date ON public.caisse_daily_tickets (chain_id, ticket_date);
CREATE INDEX caisse_daily_payments_chain_date ON public.caisse_daily_payments (chain_id, ticket_date);
CREATE INDEX caisse_daily_products_chain_date ON public.caisse_daily_products (chain_id, ticket_date);
CREATE INDEX caisse_daily_products_category ON public.caisse_daily_products (chain_id, category, ticket_date);
CREATE INDEX caisse_daily_attachment_chain_date ON public.caisse_daily_attachment (chain_id, ticket_date);

GRANT SELECT ON public.caisse_daily_tickets TO authenticated;
GRANT SELECT ON public.caisse_daily_payments TO authenticated;
GRANT SELECT ON public.caisse_daily_products TO authenticated;
GRANT SELECT ON public.caisse_daily_attachment TO authenticated;
GRANT ALL ON public.caisse_daily_tickets TO service_role;
GRANT ALL ON public.caisse_daily_payments TO service_role;
GRANT ALL ON public.caisse_daily_products TO service_role;
GRANT ALL ON public.caisse_daily_attachment TO service_role;
REVOKE ALL ON public.caisse_daily_tickets FROM anon;
REVOKE ALL ON public.caisse_daily_payments FROM anon;
REVOKE ALL ON public.caisse_daily_products FROM anon;
REVOKE ALL ON public.caisse_daily_attachment FROM anon;

ALTER TABLE public.caisse_daily_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisse_daily_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisse_daily_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisse_daily_attachment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caisse_daily_tickets_read" ON public.caisse_daily_tickets
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));
CREATE POLICY "caisse_daily_payments_read" ON public.caisse_daily_payments
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));
CREATE POLICY "caisse_daily_products_read" ON public.caisse_daily_products
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));
CREATE POLICY "caisse_daily_attachment_read" ON public.caisse_daily_attachment
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));

-- 2. Refresh incremental (idempotent) sur une plage restaurant x jours
CREATE OR REPLACE FUNCTION public.refresh_caisse_rollups(
  p_restaurant_id uuid,
  p_from date,
  p_to date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.caisse_daily_tickets
   WHERE ticket_date BETWEEN p_from AND p_to
     AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);
  DELETE FROM public.caisse_daily_payments
   WHERE ticket_date BETWEEN p_from AND p_to
     AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);
  DELETE FROM public.caisse_daily_products
   WHERE ticket_date BETWEEN p_from AND p_to
     AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);
  DELETE FROM public.caisse_daily_attachment
   WHERE ticket_date BETWEEN p_from AND p_to
     AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);

  INSERT INTO public.caisse_daily_tickets (
    restaurant_id, chain_id, ticket_date, tickets, revenue_ttc, revenue_ht, vat_amount,
    tickets_onsite, tickets_takeaway, tickets_delivery,
    revenue_onsite, revenue_takeaway, revenue_delivery
  )
  SELECT s.restaurant_id, s.chain_id, s.ticket_date,
         count(*)::bigint,
         sum(coalesce(s.total_amount, 0)),
         sum(coalesce(s.total_ht, 0)),
         sum(coalesce(s.total_vat, 0)),
         count(*) FILTER (WHERE s.service_type = 'sur_place')::bigint,
         count(*) FILTER (WHERE s.service_type = 'emporter')::bigint,
         count(*) FILTER (WHERE s.service_type = 'livraison')::bigint,
         sum(CASE WHEN s.service_type = 'sur_place' THEN coalesce(s.total_amount, 0) ELSE 0 END),
         sum(CASE WHEN s.service_type = 'emporter' THEN coalesce(s.total_amount, 0) ELSE 0 END),
         sum(CASE WHEN s.service_type = 'livraison' THEN coalesce(s.total_amount, 0) ELSE 0 END)
    FROM public.splash_tickets s
   WHERE s.ticket_date BETWEEN p_from AND p_to
     AND (p_restaurant_id IS NULL OR s.restaurant_id = p_restaurant_id)
   GROUP BY 1, 2, 3;

  INSERT INTO public.caisse_daily_payments (
    restaurant_id, chain_id, ticket_date, category, brand, payments, amount
  )
  SELECT pay.restaurant_id, pay.chain_id, pay.ticket_date,
         coalesce(pay.category, 'Autre'), coalesce(pay.brand, ''),
         count(*)::bigint, sum(coalesce(pay.amount, 0))
    FROM public.splash_ticket_payments pay
   WHERE pay.ticket_date BETWEEN p_from AND p_to
     AND (p_restaurant_id IS NULL OR pay.restaurant_id = p_restaurant_id)
   GROUP BY 1, 2, 3, 4, 5;

  INSERT INTO public.caisse_daily_products (
    restaurant_id, chain_id, ticket_date, product_key, product_name, product_ref, category, quantity, revenue
  )
  SELECT l.restaurant_id, l.chain_id, l.ticket_date,
         coalesce(nullif(l.product_ref, ''), lower(l.product_name)) AS product_key,
         min(l.product_name), min(l.product_ref), min(l.category),
         sum(coalesce(l.quantity, 0)), sum(coalesce(l.total_price, 0))
    FROM public.splash_ticket_lines l
   WHERE l.ticket_date BETWEEN p_from AND p_to
     AND (p_restaurant_id IS NULL OR l.restaurant_id = p_restaurant_id)
   GROUP BY 1, 2, 3, 4;

  -- Attachement: flags par ticket puis count(distinct ticket) par categorie
  INSERT INTO public.caisse_daily_attachment (
    restaurant_id, chain_id, ticket_date, category, tickets_with_category, tickets_total
  )
  WITH flags AS (
    SELECT DISTINCT l.restaurant_id, l.chain_id, l.ticket_date, l.category, l.ticket_uuid
      FROM public.splash_ticket_lines l
     WHERE l.ticket_date BETWEEN p_from AND p_to
       AND (p_restaurant_id IS NULL OR l.restaurant_id = p_restaurant_id)
       AND l.category IS NOT NULL
  ),
  totals AS (
    SELECT t.restaurant_id, t.ticket_date, count(*)::bigint AS tickets_total
      FROM public.splash_tickets t
     WHERE t.ticket_date BETWEEN p_from AND p_to
       AND (p_restaurant_id IS NULL OR t.restaurant_id = p_restaurant_id)
     GROUP BY 1, 2
  )
  SELECT f.restaurant_id, f.chain_id, f.ticket_date, f.category,
         count(*)::bigint,
         coalesce(tt.tickets_total, 0)
    FROM flags f
    LEFT JOIN totals tt
      ON tt.restaurant_id = f.restaurant_id AND tt.ticket_date = f.ticket_date
   GROUP BY 1, 2, 3, 4, tt.tickets_total;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_caisse_rollups(uuid, date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.refresh_caisse_rollups(uuid, date, date) TO service_role;

-- 3. RPC Caisse reecrites sur les rollups (memes signatures, memes resultats)
CREATE OR REPLACE FUNCTION public.get_caisse_payment_breakdown(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(restaurant_id uuid, restaurant_name text, tickets bigint, days_covered bigint, revenue numeric, card_amount numeric, cash_amount numeric, tr_amount numeric, platform_amount numeric, other_amount numeric, paid_total numeric, tr_share numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  with allowed as (
    select c.id from public.chains c
    where public.is_super_admin() or public.user_has_chain_access(c.id)
  ),
  t as (
    select
      d.restaurant_id,
      sum(d.tickets)::bigint as n_tickets,
      count(*)::bigint as n_days,
      sum(d.revenue_ttc) as revenue
    from public.caisse_daily_tickets d
    where d.ticket_date between p_start and p_end
      and (p_restaurant_ids is null or d.restaurant_id = any(p_restaurant_ids))
      and d.chain_id in (select id from allowed)
    group by 1
  ),
  p as (
    select
      pay.restaurant_id,
      sum(case when pay.category = 'Carte' then pay.amount else 0 end) as card_amount,
      sum(case when pay.category = 'Espèces' then pay.amount else 0 end) as cash_amount,
      sum(case when pay.category = 'Titres-resto' then pay.amount else 0 end) as tr_amount,
      sum(case when pay.category = 'Plateforme' then pay.amount else 0 end) as platform_amount,
      sum(case when pay.category = 'Autre' then pay.amount else 0 end) as other_amount,
      sum(pay.amount) as paid_total
    from public.caisse_daily_payments pay
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
$function$;

CREATE OR REPLACE FUNCTION public.get_caisse_payment_weekly(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(week_start date, card_amount numeric, cash_amount numeric, tr_amount numeric, platform_amount numeric, other_amount numeric, total_amount numeric, tr_share numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  with allowed as (
    select c.id from public.chains c
    where public.is_super_admin() or public.user_has_chain_access(c.id)
  ),
  w as (
    select
      date_trunc('week', pay.ticket_date)::date as wk,
      sum(case when pay.category = 'Carte' then pay.amount else 0 end) as card_amount,
      sum(case when pay.category = 'Espèces' then pay.amount else 0 end) as cash_amount,
      sum(case when pay.category = 'Titres-resto' then pay.amount else 0 end) as tr_amount,
      sum(case when pay.category = 'Plateforme' then pay.amount else 0 end) as platform_amount,
      sum(case when pay.category = 'Autre' then pay.amount else 0 end) as other_amount,
      sum(pay.amount) as total_amount
    from public.caisse_daily_payments pay
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
$function$;

CREATE OR REPLACE FUNCTION public.get_caisse_payment_brands(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(category text, brand text, payments bigint, amount numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  with allowed as (
    select c.id from public.chains c
    where public.is_super_admin() or public.user_has_chain_access(c.id)
  )
  select
    pay.category,
    nullif(pay.brand, '') as brand,
    sum(pay.payments)::bigint,
    round(sum(pay.amount), 2)
  from public.caisse_daily_payments pay
  where pay.ticket_date between p_start and p_end
    and (p_restaurant_ids is null or pay.restaurant_id = any(p_restaurant_ids))
    and pay.chain_id in (select id from allowed)
  group by 1, 2
  order by 4 desc;
$function$;

-- Taux d'attachement additif et exact
CREATE OR REPLACE FUNCTION public.get_caisse_attachment(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(category text, tickets_with_category bigint, tickets_total bigint, attach_rate numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
  with allowed as (
    select c.id from public.chains c
    where public.is_super_admin() or public.user_has_chain_access(c.id)
  ),
  totals as (
    select sum(d.tickets)::bigint as tickets_total
    from public.caisse_daily_tickets d
    where d.ticket_date between p_start and p_end
      and (p_restaurant_ids is null or d.restaurant_id = any(p_restaurant_ids))
      and d.chain_id in (select id from allowed)
  ),
  a as (
    select x.category, sum(x.tickets_with_category)::bigint as n
    from public.caisse_daily_attachment x
    where x.ticket_date between p_start and p_end
      and (p_restaurant_ids is null or x.restaurant_id = any(p_restaurant_ids))
      and x.chain_id in (select id from allowed)
    group by 1
  )
  select a.category, a.n, totals.tickets_total,
         round(100.0 * a.n / nullif(totals.tickets_total, 0), 1)
  from a cross join totals
  order by 2 desc;
$function$;