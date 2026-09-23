CREATE OR REPLACE FUNCTION public.get_chataigne_referral_ltv(
  p_start date,
  p_end date,
  p_restaurant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  segment text,
  cohorte text,
  mois_offset integer,
  taille_cohorte bigint,
  clients_actifs bigint,
  commandes bigint,
  ca_cumul_par_client numeric,
  contribution_cumul_par_client numeric,
  cac numeric,
  mois_observes integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
  WITH allowed AS (
    SELECT c.id FROM public.chains c
    WHERE public.is_super_admin() OR public.user_has_chain_access(c.id)
  ),
  ord AS (
    SELECT
      o.code_client,
      (o.order_datetime AT TIME ZONE 'Europe/Paris') AS dt_local,
      coalesce(o.total_amount, 0) AS total,
      CASE WHEN jsonb_typeof(o.discounts) = 'array' THEN coalesce((
        SELECT sum((d->>'amount')::numeric) FROM jsonb_array_elements(o.discounts) d
        WHERE d->>'name' IN ('Code Parrainage', 'Article Offert - Parrainage')), 0) ELSE 0 END AS disc_filleul,
      CASE WHEN jsonb_typeof(o.discounts) = 'array' THEN coalesce((
        SELECT sum((d->>'amount')::numeric) FROM jsonb_array_elements(o.discounts) d
        WHERE d->>'name' = 'Referral Reward'), 0) ELSE 0 END AS disc_parrain,
      CASE WHEN jsonb_typeof(o.discounts) = 'array' THEN coalesce((
        SELECT sum((d->>'amount')::numeric) FROM jsonb_array_elements(o.discounts) d
        WHERE d->>'name' = 'Promo de bienvenue'), 0) ELSE 0 END AS disc_welcome
    FROM public.chataigne_orders o
    WHERE o.status = 'completed'
      AND o.code_client IS NOT NULL
      AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
      AND o.chain_id IN (SELECT id FROM allowed)
  ),
  first_ord AS (
    SELECT DISTINCT ON (code_client)
      code_client,
      dt_local AS first_dt,
      disc_filleul,
      CASE WHEN disc_filleul > 0 THEN 'filleul'
           WHEN disc_welcome > 0 THEN 'bienvenue'
           ELSE 'organique' END AS segment
    FROM ord
    ORDER BY code_client, dt_local
  ),
  members AS (
    SELECT
      f.code_client,
      f.segment,
      f.disc_filleul,
      f.first_dt,
      date_trunc('month', f.first_dt)::date AS cohorte_d
    FROM first_ord f
    WHERE f.first_dt >= p_start::timestamp AND f.first_dt < (p_end + 1)::timestamp
  ),
  cohort_size AS (
    SELECT segment, cohorte_d, count(*)::bigint AS taille,
           coalesce(sum(disc_filleul), 0) AS cost_fill
    FROM members
    GROUP BY 1, 2
  ),
  parrain_month AS (
    SELECT date_trunc('month', o.dt_local)::date AS cohorte_d,
           coalesce(sum(o.disc_parrain), 0) AS cost_par
    FROM ord o
    WHERE o.disc_parrain > 0
      AND o.dt_local >= p_start::timestamp AND o.dt_local < (p_end + 1)::timestamp
    GROUP BY 1
  ),
  evts AS (
    SELECT
      m.segment,
      m.cohorte_d,
      m.code_client,
      ((date_part('year', o.dt_local) - date_part('year', m.first_dt))::int * 12
        + (date_part('month', o.dt_local) - date_part('month', m.first_dt))::int) AS mois_offset,
      o.total,
      (o.total - 1 - (0.25 + 0.015 * o.total)) AS contribution
    FROM ord o
    JOIN members m ON m.code_client = o.code_client
    WHERE o.dt_local >= m.first_dt
  ),
  agg AS (
    SELECT
      e.segment,
      e.cohorte_d,
      e.mois_offset,
      count(DISTINCT e.code_client)::bigint AS clients_actifs,
      count(*)::bigint AS commandes,
      sum(e.total) AS ca,
      sum(e.contribution) AS contrib
    FROM evts e
    WHERE e.mois_offset BETWEEN 0 AND 12
    GROUP BY 1, 2, 3
  )
  SELECT
    a.segment,
    to_char(a.cohorte_d, 'YYYY-MM') AS cohorte,
    a.mois_offset,
    cs.taille,
    a.clients_actifs,
    a.commandes,
    round(sum(a.ca) OVER (PARTITION BY a.segment, a.cohorte_d ORDER BY a.mois_offset)
          / nullif(cs.taille, 0), 2) AS ca_cumul_par_client,
    round(sum(a.contrib) OVER (PARTITION BY a.segment, a.cohorte_d ORDER BY a.mois_offset)
          / nullif(cs.taille, 0), 2) AS contribution_cumul_par_client,
    CASE WHEN a.segment = 'filleul'
      THEN round((cs.cost_fill + coalesce(pm.cost_par, 0)) / nullif(cs.taille, 0), 2)
      ELSE 0 END AS cac,
    (((date_part('year', (now() AT TIME ZONE 'Europe/Paris')) - date_part('year', a.cohorte_d)) * 12
      + (date_part('month', (now() AT TIME ZONE 'Europe/Paris')) - date_part('month', a.cohorte_d)))::int) AS mois_observes
  FROM agg a
  JOIN cohort_size cs ON cs.segment = a.segment AND cs.cohorte_d = a.cohorte_d
  LEFT JOIN parrain_month pm ON pm.cohorte_d = a.cohorte_d
  ORDER BY a.segment, a.cohorte_d, a.mois_offset;
$function$;

REVOKE ALL ON FUNCTION public.get_chataigne_referral_ltv(date, date, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_chataigne_referral_ltv(date, date, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_referral_ltv(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chataigne_referral_ltv(date, date, uuid[]) TO service_role;