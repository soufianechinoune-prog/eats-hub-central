-- Contrôle d'intégrité des tickets détaillés Splash vs total officiel de caisse.
CREATE TABLE IF NOT EXISTS public.caisse_ticket_integrity (
  restaurant_id uuid NOT NULL,
  chain_id uuid,
  station text NOT NULL DEFAULT 'default',
  ticket_date date NOT NULL,
  tickets_detail integer NOT NULL DEFAULT 0,
  revenue_detail numeric NOT NULL DEFAULT 0,
  tickets_official integer NOT NULL DEFAULT 0,
  revenue_official numeric NOT NULL DEFAULT 0,
  completeness numeric NOT NULL DEFAULT 0,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, station, ticket_date)
);

GRANT SELECT ON public.caisse_ticket_integrity TO authenticated;
GRANT ALL ON public.caisse_ticket_integrity TO service_role;

ALTER TABLE public.caisse_ticket_integrity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chain members read caisse integrity" ON public.caisse_ticket_integrity;
CREATE POLICY "Chain members read caisse integrity"
ON public.caisse_ticket_integrity
FOR SELECT
TO authenticated
USING (chain_id IS NOT NULL AND public.user_has_chain_access(chain_id));

CREATE INDEX IF NOT EXISTS idx_caisse_integrity_chain_date
  ON public.caisse_ticket_integrity (chain_id, ticket_date);
CREATE INDEX IF NOT EXISTS idx_caisse_integrity_incomplete
  ON public.caisse_ticket_integrity (ticket_date) WHERE completeness < 0.95;

-- Recalcule la complétude sur une fenêtre de dates.
CREATE OR REPLACE FUNCTION public.refresh_caisse_ticket_integrity(
  p_from date,
  p_to date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  WITH official AS (
    SELECT s.restaurant_id,
           s.chain_id,
           s.date AS ticket_date,
           SUM(s.order_count)::int AS tickets_official,
           SUM(s.revenue_ttc)      AS revenue_official
    FROM public.splash360_daily_sales s
    WHERE s.granularity = 'day'
      AND s.platform = 'global'
      AND s.date BETWEEN p_from AND p_to
      AND s.restaurant_id IS NOT NULL
    GROUP BY 1, 2, 3
  ),
  detail AS (
    SELECT t.restaurant_id,
           t.station,
           t.ticket_date,
           COUNT(*)::int            AS tickets_detail,
           COALESCE(SUM(t.total_amount), 0) AS revenue_detail
    FROM public.caisse_tickets t
    WHERE t.ticket_date BETWEEN p_from AND p_to
    GROUP BY 1, 2, 3
  ),
  merged AS (
    SELECT o.restaurant_id,
           o.chain_id,
           COALESCE(d.station, 'default') AS station,
           o.ticket_date,
           COALESCE(d.tickets_detail, 0)  AS tickets_detail,
           COALESCE(d.revenue_detail, 0)  AS revenue_detail,
           o.tickets_official,
           o.revenue_official
    FROM official o
    LEFT JOIN detail d
      ON d.restaurant_id = o.restaurant_id
     AND d.ticket_date = o.ticket_date
  )
  INSERT INTO public.caisse_ticket_integrity AS ci (
    restaurant_id, chain_id, station, ticket_date,
    tickets_detail, revenue_detail, tickets_official, revenue_official,
    completeness, checked_at
  )
  SELECT m.restaurant_id, m.chain_id, m.station, m.ticket_date,
         m.tickets_detail, m.revenue_detail, m.tickets_official, m.revenue_official,
         CASE WHEN m.tickets_official > 0
              THEN LEAST(1, m.tickets_detail::numeric / m.tickets_official)
              ELSE 1 END,
         now()
  FROM merged m
  ON CONFLICT (restaurant_id, station, ticket_date) DO UPDATE
    SET chain_id         = EXCLUDED.chain_id,
        tickets_detail   = EXCLUDED.tickets_detail,
        revenue_detail   = EXCLUDED.revenue_detail,
        tickets_official = EXCLUDED.tickets_official,
        revenue_official = EXCLUDED.revenue_official,
        completeness     = EXCLUDED.completeness,
        checked_at       = now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

-- Relance automatiquement les mois contenant des journées incomplètes.
CREATE OR REPLACE FUNCTION public.requeue_incomplete_caisse_months(
  p_threshold numeric DEFAULT 0.95,
  p_lookback_days integer DEFAULT 60
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH gaps AS (
    SELECT DISTINCT
           ci.restaurant_id,
           ci.chain_id,
           c.station,
           EXTRACT(YEAR  FROM ci.ticket_date)::int  AS year,
           EXTRACT(MONTH FROM ci.ticket_date)::int  AS month
    FROM public.caisse_ticket_integrity ci
    JOIN public.splash_restaurant_credentials c
      ON c.restaurant_id = ci.restaurant_id
     AND c.is_active = true
    WHERE ci.ticket_date >= (CURRENT_DATE - p_lookback_days)
      AND ci.ticket_date < CURRENT_DATE
      AND ci.tickets_official > 0
      AND ci.completeness < p_threshold
  ),
  upserted AS (
    INSERT INTO public.splash_ticket_backfill_jobs
      (restaurant_id, chain_id, station, year, month, status, priority, attempts, page_cursor, next_attempt_at)
    SELECT g.restaurant_id, g.chain_id, g.station, g.year, g.month, 'pending', 1, 0, 0, now()
    FROM gaps g
    ON CONFLICT (restaurant_id, station, year, month) DO UPDATE
      SET status = CASE WHEN public.splash_ticket_backfill_jobs.status = 'running'
                        THEN public.splash_ticket_backfill_jobs.status ELSE 'pending' END,
          priority = 1,
          attempts = 0,
          page_cursor = 0,
          last_error = NULL,
          completed_at = NULL,
          next_attempt_at = now(),
          updated_at = now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upserted;

  RETURN v_count;
END;
$$;

-- Complétude exposée à l'application (bannière d'alerte).
CREATE OR REPLACE FUNCTION public.get_caisse_integrity_gaps(
  p_chain_id uuid,
  p_from date,
  p_to date,
  p_restaurant_ids uuid[] DEFAULT NULL,
  p_threshold numeric DEFAULT 0.95
)
RETURNS TABLE (
  ticket_date date,
  restaurants_incomplete integer,
  tickets_detail integer,
  tickets_official integer,
  completeness numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ci.ticket_date,
         COUNT(*) FILTER (WHERE ci.completeness < p_threshold)::int,
         SUM(ci.tickets_detail)::int,
         SUM(ci.tickets_official)::int,
         CASE WHEN SUM(ci.tickets_official) > 0
              THEN ROUND(SUM(ci.tickets_detail)::numeric / SUM(ci.tickets_official), 4)
              ELSE 1 END
  FROM public.caisse_ticket_integrity ci
  WHERE ci.chain_id = p_chain_id
    AND public.user_has_chain_access(p_chain_id)
    AND ci.ticket_date BETWEEN p_from AND p_to
    AND (p_restaurant_ids IS NULL OR ci.restaurant_id = ANY (p_restaurant_ids))
  GROUP BY ci.ticket_date
  HAVING COUNT(*) FILTER (WHERE ci.completeness < p_threshold) > 0
  ORDER BY ci.ticket_date;
$$;

GRANT EXECUTE ON FUNCTION public.get_caisse_integrity_gaps(uuid, date, date, uuid[], numeric) TO authenticated;
