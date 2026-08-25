CREATE OR REPLACE FUNCTION public.get_uber_available_weeks(p_chain_id uuid)
RETURNS TABLE(week_start date, week_end date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_has_chain_access(p_chain_id) THEN
    RAISE EXCEPTION 'Access denied for chain %', p_chain_id;
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    (date_trunc('week', (o.order_datetime AT TIME ZONE 'Europe/Paris')))::date,
    ((date_trunc('week', (o.order_datetime AT TIME ZONE 'Europe/Paris')))::date + 6)
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE r.chain_id = p_chain_id
    AND o.order_datetime >= (now() - interval '3 years')
    AND COALESCE(o.status, '') NOT ILIKE '%cancel%'
  ORDER BY 1 DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_uber_available_weeks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_uber_available_weeks(uuid) TO service_role, authenticated;