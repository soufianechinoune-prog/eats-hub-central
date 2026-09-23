create or replace function public.get_chataigne_rfm_debug(p_start date, p_end date, p_restaurant_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_allowed int;
  v_ord int;
  v_seg int;
begin
  select count(*) into v_allowed
  from public.chains c
  where public.is_super_admin() or public.user_has_chain_access(c.id);

  select count(*) into v_ord
  from public.chataigne_orders o
  where o.status = 'completed'
    and o.code_client is not null
    and (p_restaurant_ids is null or o.restaurant_id = any (p_restaurant_ids))
    and o.chain_id in (select c.id from public.chains c where public.is_super_admin() or public.user_has_chain_access(c.id))
    and o.order_datetime < (p_end + 1)::timestamptz;

  return jsonb_build_object('uid_present', v_uid is not null, 'allowed_chains', v_allowed, 'ord_rows', v_ord);
end;
$$;

grant execute on function public.get_chataigne_rfm_debug(date, date, uuid[]) to authenticated;
