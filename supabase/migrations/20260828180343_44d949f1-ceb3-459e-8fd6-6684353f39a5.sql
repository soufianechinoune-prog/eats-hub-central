DROP FUNCTION IF EXISTS public.get_delivery_pnl(date, date, uuid[]);

CREATE OR REPLACE FUNCTION public.get_delivery_pnl(p_start date, p_end date, p_restaurant_ids uuid[] DEFAULT NULL)
 RETURNS TABLE(restaurant_id uuid, restaurant_name text, version text, nb_livraisons bigint, markup_total numeric, frais_livraison numeric, nb_bogo bigint, bogo_full_value numeric, naan_tenders_price numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH del AS (
    SELECT o.chataigne_order_id, o.restaurant_id AS rid, o.delivery_fee_amount, o.discounts
    FROM public.chataigne_orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.service_type='delivery'
      AND (public.is_super_admin() OR public.user_has_chain_access(r.chain_id))
      AND (p_restaurant_ids IS NULL OR cardinality(p_restaurant_ids)=0 OR o.restaurant_id = ANY(p_restaurant_ids))
      AND o.order_datetime >= (p_start::timestamp AT TIME ZONE 'Europe/Paris')
      AND o.order_datetime <  ((p_end + 1)::timestamp AT TIME ZONE 'Europe/Paris')
  ),
  mk AS (
    SELECT i.restaurant_id AS rid, SUM((i.unit_price_amount - ref.instore_price)*i.quantity) markup
    FROM public.chataigne_order_items i
    JOIN del d ON d.chataigne_order_id=i.chataigne_order_id
    JOIN public.chataigne_item_instore_ref ref ON ref.restaurant_id=i.restaurant_id AND lower(ref.item_name)=lower(i.item_name)
    WHERE i.depth=0
    GROUP BY i.restaurant_id
  ),
  bogo AS (
    SELECT d.rid,
      COUNT(*) FILTER (WHERE (x->>'name') ILIKE '%naan tenders acheté%') nb_bogo,
      COALESCE(SUM((x->>'amount')::numeric) FILTER (WHERE (x->>'name') ILIKE '%naan tenders acheté%'),0) bogo_val
    FROM del d
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.discounts)='array' THEN d.discounts ELSE '[]'::jsonb END) x
    GROUP BY d.rid
  ),
  ord AS (
    SELECT d.rid, COUNT(*) nb, COALESCE(SUM(d.delivery_fee_amount),0) fees
    FROM del d GROUP BY d.rid
  )
  SELECT o.rid, r.name::text, COALESCE(v.version,'—')::text,
    o.nb::bigint, COALESCE(mk.markup,0)::numeric, o.fees::numeric,
    COALESCE(b.nb_bogo,0)::bigint, COALESCE(b.bogo_val,0)::numeric,
    gp.price::numeric
  FROM ord o
  JOIN public.restaurants r ON r.id=o.rid
  LEFT JOIN public.restaurant_price_version v ON v.restaurant_id=o.rid
  LEFT JOIN public.instore_price_grid gp ON gp.chain_id=r.chain_id AND gp.version=v.version AND gp.product_key='naan tenders'
  LEFT JOIN mk ON mk.rid=o.rid
  LEFT JOIN bogo b ON b.rid=o.rid;
END; $$;