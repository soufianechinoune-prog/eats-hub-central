-- Ajoute offert_count / offert_vente a l'acquisition parrainage : permet de valoriser
-- le produit offert a son cout matiere (parametre ecran) plutot qu'a sa valeur de vente.
DROP FUNCTION IF EXISTS public.get_chataigne_referral_acquisition(date, date, text, uuid[]);

CREATE FUNCTION public.get_chataigne_referral_acquisition(
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
  panier_moyen_filleul numeric,
  offert_count bigint,
  offert_vente numeric
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
        WHERE d->>'name' = 'Article Offert - Parrainage'), 0) ELSE 0 END AS disc_offert,
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
      code_client, order_datetime AS first_dt, disc_filleul, disc_offert, total
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
      count(*) FILTER (WHERE f.disc_offert > 0)::bigint AS offert_count,
      coalesce(sum(f.disc_offert), 0) AS offert_vente,
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
    round(a.panier_filleul::numeric, 2),
    coalesce(a.offert_count, 0)::bigint,
    round(coalesce(a.offert_vente, 0), 2)
  FROM acq a
  FULL JOIN par p ON p.periode = a.periode
  ORDER BY 1;
$function$;

REVOKE ALL ON FUNCTION public.get_chataigne_referral_acquisition(date, date, text, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_chataigne_referral_acquisition(date, date, text, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_referral_acquisition(date, date, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chataigne_referral_acquisition(date, date, text, uuid[]) TO service_role;