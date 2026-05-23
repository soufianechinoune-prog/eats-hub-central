create or replace function public.get_refunded_orders_count(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date
)
returns table(restaurant_id uuid, refunded_orders bigint, total_orders bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.restaurant_id,
    count(*) filter (where coalesce(o.refund_incl_vat, 0) <> 0)::bigint as refunded_orders,
    count(*)::bigint as total_orders
  from public.orders o
  where o.restaurant_id = any(p_restaurant_ids)
    and (o.order_datetime at time zone 'Europe/Paris')::date between p_start_date and p_end_date
  group by o.restaurant_id;
$$;