CREATE OR REPLACE FUNCTION public.get_delivery_pnl(p_chain_id uuid, p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL)
 RETURNS TABLE(restaurant_id uuid, restaurant_name text, version text, nb_livraisons bigint, markup_total numeric, frais_livraison numeric, nb_bogo bigint, bogo_full_value numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.is_super_admin() OR public.user_has_chain_access(p_chain_id)) THEN
    RAISE EXCEPTION 'Access denied for chain %', p_chain_id;
  END IF;
  RETURN QUERY
  WITH del AS (
    SELECT o.chataigne_order_id, o.restaurant_id, o.delivery_fee_amount, o.discounts
    FROM public.chataigne_orders o
    WHERE o.chain_id=p_chain_id AND o.service_type='delivery'
      AND o.order_datetime >= (p_start::timestamp AT TIME ZONE 'Europe/Paris')
      AND o.order_datetime <  ((p_end + 1)::timestamp AT TIME ZONE 'Europe/Paris')
      AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
  ),
  mk AS (
    SELECT i.restaurant_id, SUM((i.unit_price_amount - ref.instore_price)*i.quantity) markup
    FROM public.chataigne_order_items i
    JOIN del d ON d.chataigne_order_id=i.chataigne_order_id
    JOIN public.chataigne_item_instore_ref ref ON ref.restaurant_id=i.restaurant_id AND lower(ref.item_name)=lower(i.item_name)
    WHERE i.depth=0
    GROUP BY i.restaurant_id
  ),
  bogo AS (
    SELECT d.restaurant_id,
      COUNT(*) FILTER (WHERE (x->>'name') ILIKE '%naan tenders acheté%') nb_bogo,
      COALESCE(SUM((x->>'amount')::numeric) FILTER (WHERE (x->>'name') ILIKE '%naan tenders acheté%'),0) bogo_val
    FROM del d
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.discounts)='array' THEN d.discounts ELSE '[]'::jsonb END) x
    GROUP BY d.restaurant_id
  ),
  ord AS (
    SELECT restaurant_id, COUNT(*) nb, COALESCE(SUM(delivery_fee_amount),0) fees
    FROM del GROUP BY restaurant_id
  )
  SELECT o.restaurant_id, r.name::text, COALESCE(v.version,'—')::text,
    o.nb::bigint, COALESCE(mk.markup,0)::numeric, o.fees::numeric,
    COALESCE(b.nb_bogo,0)::bigint, COALESCE(b.bogo_val,0)::numeric
  FROM ord o
  JOIN public.restaurants r ON r.id=o.restaurant_id
  LEFT JOIN public.restaurant_price_version v ON v.restaurant_id=o.restaurant_id
  LEFT JOIN mk ON mk.restaurant_id=o.restaurant_id
  LEFT JOIN bogo b ON b.restaurant_id=o.restaurant_id;
END; $$;
REVOKE ALL ON FUNCTION public.get_delivery_pnl(uuid,date,date,uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_pnl(uuid,date,date,uuid[]) TO authenticated;