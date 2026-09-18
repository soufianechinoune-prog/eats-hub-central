CREATE OR REPLACE FUNCTION public.get_caisse_product_trends(
  p_start date,
  p_end date,
  p_restaurant_ids uuid[] DEFAULT NULL,
  p_top_n int DEFAULT 10,
  p_bucket text DEFAULT 'month'
)
RETURNS TABLE (
  product_ref text,
  product_name text,
  bucket date,
  revenue numeric,
  quantity numeric,
  rank int,
  share numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
  with allowed as (
    select c.id from public.chains c
    where public.is_super_admin() or public.user_has_chain_access(c.id)
  ),
  src as (
    select
      d.product_ref,
      d.product_name,
      d.ticket_date,
      d.revenue,
      d.quantity,
      case when p_bucket = 'week'
        then date_trunc('week', d.ticket_date)::date
        else date_trunc('month', d.ticket_date)::date
      end as bucket
    from public.caisse_daily_products d
    where d.ticket_date between p_start and p_end
      and (p_restaurant_ids is null or d.restaurant_id = any(p_restaurant_ids))
      and d.chain_id in (select id from allowed)
      and d.product_ref is not null
  ),
  per_bucket as (
    select s.product_ref, s.bucket,
           sum(s.revenue) as revenue,
           sum(s.quantity) as quantity
    from src s
    group by 1, 2
  ),
  names as (
    select distinct on (s.product_ref) s.product_ref, s.product_name
    from src s
    order by s.product_ref, s.ticket_date desc
  ),
  totals as (
    select b.product_ref, sum(b.revenue) as total_revenue
    from per_bucket b
    group by 1
    order by 2 desc
    limit greatest(coalesce(p_top_n, 10), 1)
  ),
  ranked as (
    select
      b.product_ref,
      b.bucket,
      b.revenue,
      b.quantity,
      rank() over (partition by b.bucket order by b.revenue desc)::int as rank,
      b.revenue / nullif(sum(b.revenue) over (partition by b.bucket), 0) as share
    from per_bucket b
  )
  select
    r.product_ref,
    n.product_name,
    r.bucket,
    round(r.revenue, 2),
    r.quantity,
    r.rank,
    round(100.0 * coalesce(r.share, 0), 2)
  from ranked r
  join totals t on t.product_ref = r.product_ref
  left join names n on n.product_ref = r.product_ref
  order by r.bucket, r.rank;
$$;

REVOKE ALL ON FUNCTION public.get_caisse_product_trends(date, date, uuid[], int, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_caisse_product_trends(date, date, uuid[], int, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_caisse_product_movers(
  p_start date,
  p_end date,
  p_restaurant_ids uuid[] DEFAULT NULL,
  p_top_n int DEFAULT 10,
  p_bucket text DEFAULT 'month'
)
RETURNS TABLE (
  product_ref text,
  product_name text,
  first_rank int,
  last_rank int,
  rank_delta int,
  first_share numeric,
  last_share numeric,
  share_delta numeric,
  first_revenue numeric,
  last_revenue numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
  with allowed as (
    select c.id from public.chains c
    where public.is_super_admin() or public.user_has_chain_access(c.id)
  ),
  src as (
    select
      d.product_ref,
      d.product_name,
      d.ticket_date,
      d.revenue,
      case when p_bucket = 'week'
        then date_trunc('week', d.ticket_date)::date
        else date_trunc('month', d.ticket_date)::date
      end as bucket
    from public.caisse_daily_products d
    where d.ticket_date between p_start and p_end
      and (p_restaurant_ids is null or d.restaurant_id = any(p_restaurant_ids))
      and d.chain_id in (select id from allowed)
      and d.product_ref is not null
  ),
  per_bucket as (
    select s.product_ref, s.bucket, sum(s.revenue) as revenue
    from src s group by 1, 2
  ),
  names as (
    select distinct on (s.product_ref) s.product_ref, s.product_name
    from src s
    order by s.product_ref, s.ticket_date desc
  ),
  ranked as (
    select
      b.*,
      rank() over (partition by b.bucket order by b.revenue desc)::int as rank,
      100.0 * b.revenue / nullif(sum(b.revenue) over (partition by b.bucket), 0) as share
    from per_bucket b
  ),
  bounds as (
    select min(bucket) as first_bucket, max(bucket) as last_bucket from per_bucket
  ),
  f as (
    select r.* from ranked r, bounds bo where r.bucket = bo.first_bucket
  ),
  l as (
    select r.* from ranked r, bounds bo where r.bucket = bo.last_bucket
  ),
  joined as (
    select
      coalesce(f.product_ref, l.product_ref) as product_ref,
      f.rank as first_rank,
      l.rank as last_rank,
      f.share as first_share,
      l.share as last_share,
      f.revenue as first_revenue,
      l.revenue as last_revenue
    from f full join l on l.product_ref = f.product_ref
  )
  select
    j.product_ref,
    n.product_name,
    j.first_rank,
    j.last_rank,
    case when j.first_rank is null or j.last_rank is null then null
         else j.first_rank - j.last_rank end,
    round(coalesce(j.first_share, 0), 2),
    round(coalesce(j.last_share, 0), 2),
    round(coalesce(j.last_share, 0) - coalesce(j.first_share, 0), 2),
    round(coalesce(j.first_revenue, 0), 2),
    round(coalesce(j.last_revenue, 0), 2)
  from joined j
  left join names n on n.product_ref = j.product_ref
  where coalesce(j.first_revenue, 0) + coalesce(j.last_revenue, 0) > 0
  order by abs(coalesce(j.last_share, 0) - coalesce(j.first_share, 0)) desc
  limit greatest(coalesce(p_top_n, 10), 1) * 4;
$$;

REVOKE ALL ON FUNCTION public.get_caisse_product_movers(date, date, uuid[], int, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_caisse_product_movers(date, date, uuid[], int, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_caisse_product_seasonality(
  p_product_ref text,
  p_restaurant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  month_of_year int,
  years_covered int,
  avg_revenue numeric,
  total_revenue numeric,
  total_quantity numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
  with allowed as (
    select c.id from public.chains c
    where public.is_super_admin() or public.user_has_chain_access(c.id)
  ),
  per_month as (
    select
      extract(month from d.ticket_date)::int as month_of_year,
      extract(year from d.ticket_date)::int as yr,
      sum(d.revenue) as revenue,
      sum(d.quantity) as quantity
    from public.caisse_daily_products d
    where d.product_ref = p_product_ref
      and (p_restaurant_ids is null or d.restaurant_id = any(p_restaurant_ids))
      and d.chain_id in (select id from allowed)
    group by 1, 2
  )
  select
    m.month_of_year,
    count(*)::int,
    round(avg(m.revenue), 2),
    round(sum(m.revenue), 2),
    sum(m.quantity)
  from per_month m
  group by 1
  order by 1;
$$;

REVOKE ALL ON FUNCTION public.get_caisse_product_seasonality(text, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_caisse_product_seasonality(text, uuid[]) TO authenticated, service_role;