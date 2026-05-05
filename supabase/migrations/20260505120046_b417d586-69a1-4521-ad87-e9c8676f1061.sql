-- Fonction atomique : pioche N jobs pending et les marque running
CREATE OR REPLACE FUNCTION public.splash_backfill_pick_batch(p_batch_size INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  chain_id UUID,
  connection_id UUID,
  restaurant_splash_id INTEGER,
  restaurant_name TEXT,
  year INTEGER,
  month INTEGER,
  attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT j.id
    FROM public.splash_backfill_jobs j
    WHERE j.status = 'pending'
    ORDER BY j.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.splash_backfill_jobs j
     SET status = 'running',
         started_at = now(),
         attempts = j.attempts + 1
   FROM picked
   WHERE j.id = picked.id
   RETURNING j.id, j.chain_id, j.connection_id, j.restaurant_splash_id,
             j.restaurant_name, j.year, j.month, j.attempts;
END;
$$;

-- Fonction : enqueue un backfill pour une marque sur une plage de mois
-- Auto-découvre les restos via splash360_restaurant_mapping
CREATE OR REPLACE FUNCTION public.enqueue_splash_backfill_for_chain(
  p_chain_id UUID,
  p_start_year INTEGER,
  p_start_month INTEGER,
  p_end_year INTEGER,
  p_end_month INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_connection_id UUID;
  v_inserted INTEGER := 0;
  v_year INTEGER;
  v_month INTEGER;
  v_cur_year INTEGER := p_start_year;
  v_cur_month INTEGER := p_start_month;
BEGIN
  -- Vérifier accès super admin
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only super admin can enqueue backfill';
  END IF;

  -- Récupérer la connexion Splash active de cette marque
  SELECT id INTO v_connection_id
  FROM public.chain_pos_connections
  WHERE chain_id = p_chain_id
    AND connector_id = 'splash360'
    AND is_active = true
  LIMIT 1;

  IF v_connection_id IS NULL THEN
    RAISE EXCEPTION 'No active Splash360 connection found for chain %', p_chain_id;
  END IF;

  -- Boucler sur tous les mois de la plage
  WHILE (v_cur_year < p_end_year)
     OR (v_cur_year = p_end_year AND v_cur_month <= p_end_month)
  LOOP
    -- Insérer 1 job par (resto × ce mois). On exclut splash_id=0 (réseau global, déjà traité).
    -- Idempotent : ON CONFLICT DO NOTHING (sauf si status=error → reset)
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
        AND m.restaurant_splash_id IS NOT NULL
        AND m.restaurant_splash_id <> 0
      ON CONFLICT (chain_id, restaurant_splash_id, year, month) DO NOTHING
      RETURNING 1
    )
    SELECT v_inserted + COALESCE((SELECT COUNT(*) FROM ins), 0) INTO v_inserted;

    -- Re-pending les jobs error de cette plage pour leur donner une nouvelle chance
    UPDATE public.splash_backfill_jobs
       SET status = 'pending', attempts = 0, last_error = NULL, started_at = NULL
     WHERE chain_id = p_chain_id
       AND year = v_cur_year
       AND month = v_cur_month
       AND status = 'error';

    -- Avancer d'un mois
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

-- Réinitialise les jobs bloqués en "running" depuis trop longtemps (>10 min)
-- Les remet en pending pour relance par le prochain worker
CREATE OR REPLACE FUNCTION public.splash_backfill_reset_stuck()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH reset AS (
    UPDATE public.splash_backfill_jobs
       SET status = 'pending', started_at = NULL
     WHERE status = 'running'
       AND started_at < now() - INTERVAL '10 minutes'
     RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM reset;
  RETURN v_count;
END;
$$;