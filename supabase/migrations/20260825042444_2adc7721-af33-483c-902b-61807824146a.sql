CREATE OR REPLACE FUNCTION public.get_uber_available_weeks(p_chain_id uuid)
RETURNS TABLE(week_start date, week_end date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_data timestamptz;
  v_end_week date;
  v_start_week date;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_has_chain_access(p_chain_id) THEN
    RAISE EXCEPTION 'Access denied for chain %', p_chain_id;
  END IF;

  -- Dernière commande connue (fenêtre courte : requête peu coûteuse)
  SELECT max(o.order_datetime) INTO v_last_data
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE r.chain_id = p_chain_id
    AND o.order_datetime >= (now() - interval '30 days');

  IF v_last_data IS NULL THEN
    SELECT max(wr.week_end)::timestamptz INTO v_last_data
    FROM public.weekly_reports wr
    WHERE wr.chain_id = p_chain_id;
  END IF;

  IF v_last_data IS NULL THEN
    RETURN;
  END IF;

  -- Dernière semaine COMPLÈTE couverte par les données
  v_end_week := (date_trunc('week', (v_last_data AT TIME ZONE 'Europe/Paris')))::date;
  IF v_end_week + 6 > ((v_last_data AT TIME ZONE 'Europe/Paris')::date) THEN
    v_end_week := v_end_week - 7;
  END IF;

  -- Début : première semaine déjà connue, sinon 2 ans en arrière
  SELECT min(wr.week_start) INTO v_start_week
  FROM public.weekly_reports wr
  WHERE wr.chain_id = p_chain_id;

  v_start_week := COALESCE(v_start_week, v_end_week - (7 * 104));

  RETURN QUERY
  SELECT g::date, (g::date + 6)
  FROM generate_series(v_start_week::timestamp, v_end_week::timestamp, interval '7 days') g
  ORDER BY 1 DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_uber_available_weeks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_uber_available_weeks(uuid) TO service_role, authenticated;