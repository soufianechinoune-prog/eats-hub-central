CREATE OR REPLACE FUNCTION public.backfill_orders_data_source_for_restaurant(p_restaurant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Marquer les commandes API basées sur les jobs backfill terminés
  WITH updated AS (
    UPDATE public.orders o
    SET data_source = 'uber_api'
    FROM public.backfill_jobs bj
    WHERE bj.status = 'done'
      AND bj.restaurant_id = p_restaurant_id
      AND o.restaurant_id = p_restaurant_id
      AND o.order_datetime >= bj.month_start::timestamptz
      AND o.order_datetime < (bj.month_end + INTERVAL '1 day')
      AND o.data_source IS NULL
    RETURNING o.id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  -- Marquer le reste de ce resto comme CSV
  UPDATE public.orders
  SET data_source = 'csv_import'
  WHERE restaurant_id = p_restaurant_id
    AND data_source IS NULL;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_orders_data_source_for_restaurant(UUID) TO authenticated;
