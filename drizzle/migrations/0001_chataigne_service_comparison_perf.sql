CREATE OR REPLACE FUNCTION public.get_chataigne_service_comparison(
  p_start date,
  p_end date,
  p_restaurant_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  service_type text,
  has_promo boolean,
  orders bigint,
  revenue numeric,
  avg_basket numeric,
  net_collected numeric,
  instore_ref numeric,
  collection_rate numeric,
  orders_with_ref bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
  with allowed as (
    select c.id
    from public.chains c
    where public.is_super_admin() or public.user_has_chain_access(c.id)
  ),
  base as (
    select
      o.chataigne_order_id,
      o.restaurant_id,
      case when o.service_type = 'delivery' then 'delivery' else 'collection' end as svc,
      (coalesce(o.discount_total_amount, 0) > 0
        or (o.discounts is not null and jsonb_typeof(o.discounts) = 'array' and jsonb_array_length(o.discounts) > 0)) as promo,
      coalesce(o.total_amount, 0) as total
    from public.chataigne_orders o
    where o.order_datetime >= p_start::timestamptz
      and o.order_datetime < (p_end + 1)::timestamptz
      and (p_restaurant_ids is null or o.restaurant_id = any(p_restaurant_ids))
      and o.chain_id in (select id from allowed)
  ),
  ref_per_order as (
    select i.chataigne_order_id, sum(g.instore_price * i.quantity) as ref_value
    from public.chataigne_order_items i
    join base b on b.chataigne_order_id = i.chataigne_order_id
    join public.chataigne_item_instore_ref g
      on g.restaurant_id = b.restaurant_id and g.item_name = i.item_name
    where i.depth = 0
      and i.item_type in ('product', 'bundle')
      and coalesce(i.unit_price_amount, 0) > 0
      and coalesce(g.instore_price, 0) > 0
    group by 1
  ),
  agg as (
    select
      b.svc,
      b.promo,
      count(*)::bigint as n_orders,
      sum(b.total) as revenue,
      sum(b.total - 1 - (0.25 + 0.015 * b.total) - case when b.svc = 'delivery' then 3 else 0 end) as net,
      count(r.chataigne_order_id)::bigint as n_ref,
      sum(coalesce(r.ref_value, 0)) as ref_total,
      sum(case when r.chataigne_order_id is not null
        then b.total - 1 - (0.25 + 0.015 * b.total) - case when b.svc = 'delivery' then 3 else 0 end
        else 0 end) as net_on_ref
    from base b
    left join ref_per_order r on r.chataigne_order_id = b.chataigne_order_id
    group by 1, 2
  )
  select
    a.svc,
    a.promo,
    a.n_orders,
    round(a.revenue, 2),
    round(a.revenue / nullif(a.n_orders, 0), 2),
    round(a.net, 2),
    round(a.ref_total, 2),
    round(100.0 * a.net_on_ref / nullif(a.ref_total, 0), 1),
    a.n_ref
  from agg a
  order by a.svc, a.promo;
$function$;

REVOKE ALL ON FUNCTION public.get_chataigne_service_comparison(date, date, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_service_comparison(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chataigne_service_comparison(date, date, uuid[]) TO service_role;