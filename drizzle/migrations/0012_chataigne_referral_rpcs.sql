-- Parrainage Chataigne : acquisition, payback, retention, segments
-- Anti-fan-out : agregation par code_client avant composition, remises lues par sous-agregat sur discounts.

CREATE OR REPLACE FUNCTION public.get_chataigne_referral_acquisition(
  p_start date,
  p_end date,
  p_granularity text DEFAULT 'week',
  p_restaurant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  periode date,
  filleuls bigint,
  parrains bigint,
  nouveaux_clients bigint,
  part_parrainage numeric,
  viralite numeric,
  cout_filleul numeric,
  cout_parrain numeric,
  cac numeric,
  panier_moyen_filleul numeric
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
      o.order_datetime,
      coalesce(o.total_amount, 0) AS total,
      CASE WHEN jsonb_typeof(o.discounts) = 'array' THEN coalesce((
        SELECT sum((d->>'amount')::numeric) FROM jsonb_array_elements(o.discounts) d
        WHERE d->>'name' IN ('Code Parrainage', 'Article Offert - Parrainage')), 0) ELSE 0 END AS disc_filleul,
      CASE WHEN jsonb_typeof(o.discounts) = 'array' THEN coalesce((
        SELECT sum((d->>'amount')::numeric) FROM jsonb_array_elements(o.discounts) d
        WHERE d->>'name' = 'Referral Reward'), 0) ELSE 0 END AS disc_parrain
    FROM public.chataigne_orders o
    WHERE o.status = 'completed'
      AND o.code_client IS NOT NULL
      AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
      AND o.chain_id IN (SELECT id FROM allowed)
  ),
  first_ord AS (
    SELECT DISTINCT ON (code_client)
      code_client, order_datetime AS first_dt, disc_filleul, total
    FROM ord
    ORDER BY code_client, order_datetime
  ),
  g AS (
    SELECT CASE lower(coalesce(p_granularity, 'week'))
      WHEN 'day' THEN 'day' WHEN 'month' THEN 'month' ELSE 'week' END AS unit
  ),
  acq AS (
    SELECT
      date_trunc((SELECT unit FROM g), f.first_dt)::date AS periode,
      count(*)::bigint AS nouveaux,
      count(*) FILTER (WHERE f.disc_filleul > 0)::bigint AS filleuls,
      coalesce(sum(f.disc_filleul), 0) AS cout_filleul,
      avg(f.total) FILTER (WHERE f.disc_filleul > 0) AS panier_filleul
    FROM first_ord f
    WHERE f.first_dt >= p_start::timestamptz AND f.first_dt < (p_end + 1)::timestamptz
    GROUP BY 1
  ),
  par AS (
    SELECT
      date_trunc((SELECT unit FROM g), o.order_datetime)::date AS periode,
      count(DISTINCT o.code_client)::bigint AS parrains,
      coalesce(sum(o.disc_parrain), 0) AS cout_parrain
    FROM ord o
    WHERE o.disc_parrain > 0
      AND o.order_datetime >= p_start::timestamptz AND o.order_datetime < (p_end + 1)::timestamptz
    GROUP BY 1
  )
  SELECT
    coalesce(a.periode, p.periode) AS periode,
    coalesce(a.filleuls, 0)::bigint,
    coalesce(p.parrains, 0)::bigint,
    coalesce(a.nouveaux, 0)::bigint,
    round(100.0 * coalesce(a.filleuls, 0) / nullif(a.nouveaux, 0), 1),
    round(coalesce(a.filleuls, 0)::numeric / nullif(p.parrains, 0), 2),
    round(coalesce(a.cout_filleul, 0), 2),
    round(coalesce(p.cout_parrain, 0), 2),
    round((coalesce(a.cout_filleul, 0) + coalesce(p.cout_parrain, 0)) / nullif(a.filleuls, 0), 2),
    round(a.panier_filleul::numeric, 2)
  FROM acq a
  FULL JOIN par p ON p.periode = a.periode
  ORDER BY 1;
$function$;

REVOKE ALL ON FUNCTION public.get_chataigne_referral_acquisition(date, date, text, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_chataigne_referral_acquisition(date, date, text, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_referral_acquisition(date, date, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chataigne_referral_acquisition(date, date, text, uuid[]) TO service_role;


CREATE OR REPLACE FUNCTION public.get_chataigne_referral_payback(
  p_start date,
  p_end date,
  p_restaurant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  basis text,
  x integer,
  clients bigint,
  contribution_moy numeric,
  contribution_cumul numeric,
  cac numeric,
  filleuls_total bigint
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
      o.order_datetime,
      coalesce(o.total_amount, 0) AS total,
      CASE WHEN jsonb_typeof(o.discounts) = 'array' THEN coalesce((
        SELECT sum((d->>'amount')::numeric) FROM jsonb_array_elements(o.discounts) d
        WHERE d->>'name' IN ('Code Parrainage', 'Article Offert - Parrainage')), 0) ELSE 0 END AS disc_filleul,
      CASE WHEN jsonb_typeof(o.discounts) = 'array' THEN coalesce((
        SELECT sum((d->>'amount')::numeric) FROM jsonb_array_elements(o.discounts) d
        WHERE d->>'name' = 'Referral Reward'), 0) ELSE 0 END AS disc_parrain
    FROM public.chataigne_orders o
    WHERE o.status = 'completed'
      AND o.code_client IS NOT NULL
      AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
      AND o.chain_id IN (SELECT id FROM allowed)
  ),
  first_ord AS (
    SELECT DISTINCT ON (code_client)
      code_client, order_datetime AS first_dt, disc_filleul
    FROM ord
    ORDER BY code_client, order_datetime
  ),
  fill AS (
    SELECT code_client, first_dt, disc_filleul
    FROM first_ord
    WHERE disc_filleul > 0
      AND first_dt >= p_start::timestamptz AND first_dt < (p_end + 1)::timestamptz
  ),
  nb AS (SELECT count(*)::bigint AS n, coalesce(sum(disc_filleul), 0) AS cost_fill FROM fill),
  parrain_cost AS (
    SELECT coalesce(sum(o.disc_parrain), 0) AS cost_par
    FROM ord o
    WHERE o.disc_parrain > 0
      AND o.order_datetime >= p_start::timestamptz AND o.order_datetime < (p_end + 1)::timestamptz
  ),
  cac_v AS (
    SELECT round(((SELECT cost_fill FROM nb) + (SELECT cost_par FROM parrain_cost)) / nullif((SELECT n FROM nb), 0), 2) AS cac
  ),
  evts AS (
    SELECT
      o.code_client,
      row_number() OVER (PARTITION BY o.code_client ORDER BY o.order_datetime) AS rang,
      greatest(date_part('day', o.order_datetime - f.first_dt), 0)::int AS jours,
      (o.total - 1 - (0.25 + 0.015 * o.total)) AS contribution
    FROM ord o
    JOIN fill f ON f.code_client = o.code_client
    WHERE o.order_datetime >= f.first_dt
  ),
  by_rank AS (
    SELECT rang::int AS x, count(*)::bigint AS clients, sum(contribution) AS contrib
    FROM evts WHERE rang <= 10
    GROUP BY 1
  ),
  rank_rows AS (
    SELECT
      'rank'::text AS basis, x, clients,
      round(contrib / nullif((SELECT n FROM nb), 0), 2) AS moy,
      round(sum(contrib) OVER (ORDER BY x) / nullif((SELECT n FROM nb), 0), 2) AS cumul
    FROM by_rank
  ),
  thresholds AS (
    SELECT unnest(ARRAY[0, 7, 14, 30, 45, 60, 90, 120, 180]) AS x
  ),
  day_rows AS (
    SELECT
      'days'::text AS basis,
      t.x,
      (SELECT count(DISTINCT e.code_client) FROM evts e WHERE e.jours <= t.x)::bigint AS clients,
      NULL::numeric AS moy,
      round((SELECT coalesce(sum(e.contribution), 0) FROM evts e WHERE e.jours <= t.x)
            / nullif((SELECT n FROM nb), 0), 2) AS cumul
    FROM thresholds t
  )
  SELECT r.basis, r.x, r.clients, r.moy, r.cumul, (SELECT cac FROM cac_v), (SELECT n FROM nb)
  FROM (SELECT * FROM rank_rows UNION ALL SELECT * FROM day_rows) r
  ORDER BY r.basis, r.x;
$function$;

REVOKE ALL ON FUNCTION public.get_chataigne_referral_payback(date, date, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_chataigne_referral_payback(date, date, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_referral_payback(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chataigne_referral_payback(date, date, uuid[]) TO service_role;


CREATE OR REPLACE FUNCTION public.get_chataigne_referral_retention(
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
  taux_pct numeric
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
      o.order_datetime,
      CASE WHEN jsonb_typeof(o.discounts) = 'array' THEN coalesce((
        SELECT sum((d->>'amount')::numeric) FROM jsonb_array_elements(o.discounts) d
        WHERE d->>'name' IN ('Code Parrainage', 'Article Offert - Parrainage')), 0) ELSE 0 END AS disc_filleul,
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
      order_datetime AS first_dt,
      CASE WHEN disc_filleul > 0 THEN 'filleul'
           WHEN disc_welcome > 0 THEN 'bienvenue'
           ELSE 'organique' END AS segment
    FROM ord
    ORDER BY code_client, order_datetime
  ),
  cohort AS (
    SELECT code_client, segment, first_dt,
      to_char(date_trunc('month', first_dt), 'YYYY-MM') AS cohorte
    FROM first_ord
    WHERE first_dt >= p_start::timestamptz AND first_dt < (p_end + 1)::timestamptz
  ),
  sizes AS (
    SELECT segment, cohorte, count(*)::bigint AS taille FROM cohort GROUP BY 1, 2
  ),
  activity AS (
    SELECT
      c.segment, c.cohorte, c.code_client,
      (date_part('year', o.order_datetime) - date_part('year', c.first_dt))::int * 12
        + (date_part('month', o.order_datetime) - date_part('month', c.first_dt))::int AS mois_offset
    FROM cohort c
    JOIN ord o ON o.code_client = c.code_client
    WHERE o.order_datetime > c.first_dt
  ),
  actives AS (
    SELECT segment, cohorte, mois_offset, count(DISTINCT code_client)::bigint AS actifs
    FROM activity
    WHERE mois_offset BETWEEN 1 AND 6
    GROUP BY 1, 2, 3
  )
  SELECT
    s.segment, s.cohorte, a.mois_offset, s.taille,
    coalesce(a.actifs, 0)::bigint,
    round(100.0 * coalesce(a.actifs, 0) / nullif(s.taille, 0), 1)
  FROM sizes s
  JOIN actives a ON a.segment = s.segment AND a.cohorte = s.cohorte
  ORDER BY s.segment, s.cohorte, a.mois_offset;
$function$;

REVOKE ALL ON FUNCTION public.get_chataigne_referral_retention(date, date, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_chataigne_referral_retention(date, date, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_referral_retention(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chataigne_referral_retention(date, date, uuid[]) TO service_role;


CREATE OR REPLACE FUNCTION public.get_chataigne_referral_segments(
  p_start date,
  p_end date,
  p_restaurant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  segment text,
  ordre integer,
  clients bigint,
  taux_reachat numeric,
  commandes_moy numeric,
  panier_moyen numeric,
  contribution_moy numeric
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
      o.order_datetime,
      coalesce(o.total_amount, 0) AS total,
      CASE WHEN jsonb_typeof(o.discounts) = 'array' THEN coalesce((
        SELECT sum((d->>'amount')::numeric) FROM jsonb_array_elements(o.discounts) d
        WHERE d->>'name' IN ('Code Parrainage', 'Article Offert - Parrainage')), 0) ELSE 0 END AS disc_filleul,
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
      order_datetime AS first_dt,
      CASE WHEN disc_filleul > 0 THEN 'filleul'
           WHEN disc_welcome > 0 THEN 'bienvenue'
           ELSE 'organique' END AS segment
    FROM ord
    ORDER BY code_client, order_datetime
  ),
  cohort AS (
    SELECT * FROM first_ord
    WHERE first_dt >= p_start::timestamptz AND first_dt < (p_end + 1)::timestamptz
  ),
  per_client AS (
    SELECT
      c.segment,
      c.code_client,
      count(*)::int AS nb,
      avg(o.total) AS panier,
      sum(o.total - 1 - (0.25 + 0.015 * o.total)) AS contribution
    FROM cohort c
    JOIN ord o ON o.code_client = c.code_client AND o.order_datetime >= c.first_dt
    GROUP BY 1, 2
  )
  SELECT
    segment,
    CASE segment WHEN 'filleul' THEN 1 WHEN 'bienvenue' THEN 2 ELSE 3 END,
    count(*)::bigint,
    round(100.0 * count(*) FILTER (WHERE nb >= 2) / nullif(count(*), 0), 1),
    round(avg(nb)::numeric, 2),
    round(avg(panier)::numeric, 2),
    round(avg(contribution)::numeric, 2)
  FROM per_client
  GROUP BY 1, 2
  ORDER BY 2;
$function$;

REVOKE ALL ON FUNCTION public.get_chataigne_referral_segments(date, date, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_chataigne_referral_segments(date, date, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_referral_segments(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chataigne_referral_segments(date, date, uuid[]) TO service_role;
