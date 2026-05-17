-- 1. Aperçu du mapping Splash360 pour une chain
CREATE OR REPLACE FUNCTION public.splash_mapping_overview(p_chain_id uuid)
RETURNS TABLE(
  restaurant_splash_id integer,
  splash_name text,
  restaurant_id uuid,
  restaurant_name text,
  is_mapped boolean,
  duplicate_splash_ids integer[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT
      m.restaurant_splash_id,
      m.splash_name,
      m.restaurant_id,
      r.name AS restaurant_name
    FROM public.splash360_restaurant_mapping m
    LEFT JOIN public.restaurants r ON r.id = m.restaurant_id
    WHERE m.chain_id = p_chain_id
      AND m.restaurant_splash_id IS NOT NULL
      AND m.restaurant_splash_id <> 0
  ),
  dup_groups AS (
    SELECT
      restaurant_id,
      array_agg(restaurant_splash_id ORDER BY restaurant_splash_id) AS group_ids
    FROM base
    WHERE restaurant_id IS NOT NULL
    GROUP BY restaurant_id
    HAVING COUNT(*) > 1
  )
  SELECT
    b.restaurant_splash_id,
    b.splash_name,
    b.restaurant_id,
    b.restaurant_name,
    (b.restaurant_id IS NOT NULL) AS is_mapped,
    COALESCE(
      (SELECT array_agg(x) FROM unnest(d.group_ids) AS x WHERE x <> b.restaurant_splash_id),
      ARRAY[]::integer[]
    ) AS duplicate_splash_ids
  FROM base b
  LEFT JOIN dup_groups d ON d.restaurant_id = b.restaurant_id
  ORDER BY b.splash_name NULLS LAST, b.restaurant_splash_id;
$$;

-- 2. Backfill ciblé sur une liste de splash_ids
CREATE OR REPLACE FUNCTION public.enqueue_splash_backfill_for_restaurants(
  p_chain_id uuid,
  p_splash_ids integer[],
  p_start_year integer,
  p_start_month integer,
  p_end_year integer,
  p_end_month integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_connection_id UUID;
  v_inserted INTEGER := 0;
  v_cur_year INTEGER := p_start_year;
  v_cur_month INTEGER := p_start_month;
  v_added INTEGER;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only super admin can enqueue backfill';
  END IF;

  IF p_splash_ids IS NULL OR array_length(p_splash_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'p_splash_ids must contain at least one restaurant_splash_id';
  END IF;

  SELECT id INTO v_connection_id
  FROM public.chain_pos_connections
  WHERE chain_id = p_chain_id
    AND connector_id = 'splash360'
    AND is_active = true
  LIMIT 1;

  IF v_connection_id IS NULL THEN
    RAISE EXCEPTION 'No active Splash360 connection found for chain %', p_chain_id;
  END IF;

  WHILE (v_cur_year < p_end_year)
     OR (v_cur_year = p_end_year AND v_cur_month <= p_end_month)
  LOOP
    WITH ins AS (
      INSERT INTO public.splash_backfill_jobs (
        chain_id, connection_id, restaurant_splash_id, restaurant_name, year, month, status, attempts
      )
      SELECT
        p_chain_id,
        v_connection_id,
        m.restaurant_splash_id,
        m.splash_name,
        v_cur_year,
        v_cur_month,
        'pending',
        0
      FROM public.splash360_restaurant_mapping m
      WHERE m.chain_id = p_chain_id
        AND m.restaurant_splash_id = ANY(p_splash_ids)
        AND m.restaurant_splash_id <> 0
      ON CONFLICT (chain_id, restaurant_splash_id, year, month) DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_added FROM ins;
    v_inserted := v_inserted + COALESCE(v_added, 0);

    UPDATE public.splash_backfill_jobs
       SET status = 'pending', attempts = 0, last_error = NULL, started_at = NULL
     WHERE chain_id = p_chain_id
       AND restaurant_splash_id = ANY(p_splash_ids)
       AND year = v_cur_year
       AND month = v_cur_month
       AND status = 'error';

    IF v_cur_month = 12 THEN
      v_cur_year := v_cur_year + 1;
      v_cur_month := 1;
    ELSE
      v_cur_month := v_cur_month + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;

-- 3. Mettre à jour l'association splash_id → restaurant_id
CREATE OR REPLACE FUNCTION public.update_splash_mapping(
  p_splash_id integer,
  p_restaurant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chain_id uuid;
  v_resto_chain_id uuid;
BEGIN
  SELECT chain_id INTO v_chain_id
  FROM public.splash360_restaurant_mapping
  WHERE restaurant_splash_id = p_splash_id
  LIMIT 1;

  IF v_chain_id IS NULL THEN
    RAISE EXCEPTION 'Splash mapping % not found', p_splash_id;
  END IF;

  IF NOT (is_super_admin() OR user_has_chain_access(v_chain_id)) THEN
    RAISE EXCEPTION 'Not authorized to modify this chain mapping';
  END IF;

  IF p_restaurant_id IS NOT NULL THEN
    SELECT chain_id INTO v_resto_chain_id FROM public.restaurants WHERE id = p_restaurant_id;
    IF v_resto_chain_id IS NULL OR v_resto_chain_id <> v_chain_id THEN
      RAISE EXCEPTION 'Restaurant % does not belong to chain %', p_restaurant_id, v_chain_id;
    END IF;
  END IF;

  UPDATE public.splash360_restaurant_mapping
     SET restaurant_id = p_restaurant_id
   WHERE restaurant_splash_id = p_splash_id;
END;
$$;