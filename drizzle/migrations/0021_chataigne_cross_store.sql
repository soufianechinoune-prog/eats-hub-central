CREATE OR REPLACE FUNCTION public.get_chataigne_cross_store(
  p_start date,
  p_end date,
  p_restaurant_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
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
  cr AS (
    SELECT
      o.code_client,
      o.restaurant_id,
      count(*)::bigint AS commandes,
      sum(coalesce(o.total_amount, 0)) AS ca
    FROM public.chataigne_orders o
    WHERE o.status = 'completed'
      AND o.code_client IS NOT NULL
      AND o.restaurant_id IS NOT NULL
      AND (o.order_datetime AT TIME ZONE 'Europe/Paris')::date BETWEEN p_start AND p_end
      AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
      AND o.chain_id IN (SELECT id FROM allowed)
    GROUP BY 1, 2
  ),
  cl AS (
    SELECT
      code_client,
      count(DISTINCT restaurant_id)::int AS nb_restos,
      sum(commandes)::bigint AS commandes,
      sum(ca) AS ca
    FROM cr
    GROUP BY 1
  ),
  profils AS (
    SELECT
      CASE WHEN nb_restos = 1 THEN '1 restaurant'
           WHEN nb_restos = 2 THEN '2 restaurants'
           WHEN nb_restos = 3 THEN '3 restaurants'
           ELSE '4 restaurants et +' END AS profil,
      min(nb_restos) AS tri,
      count(*)::bigint AS clients,
      sum(commandes)::bigint AS commandes,
      sum(ca) AS ca
    FROM cl
    GROUP BY 1
  ),
  paires AS (
    SELECT
      a.restaurant_id AS resto_a,
      b.restaurant_id AS resto_b,
      count(DISTINCT a.code_client)::bigint AS clients_communs,
      sum(a.commandes + b.commandes)::bigint AS commandes,
      sum(a.ca + b.ca) AS ca
    FROM cr a
    JOIN cr b ON b.code_client = a.code_client AND b.restaurant_id > a.restaurant_id
    GROUP BY 1, 2
    ORDER BY 3 DESC
    LIMIT 40
  ),
  par_resto AS (
    SELECT
      cr.restaurant_id,
      count(DISTINCT cr.code_client)::bigint AS clients,
      count(DISTINCT cr.code_client) FILTER (WHERE cl.nb_restos > 1)::bigint AS clients_partages,
      sum(cr.commandes)::bigint AS commandes,
      sum(cr.ca) AS ca,
      sum(cr.ca) FILTER (WHERE cl.nb_restos > 1) AS ca_partage
    FROM cr
    JOIN cl ON cl.code_client = cr.code_client
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'clients', coalesce(count(*), 0),
        'clients_mono', coalesce(count(*) FILTER (WHERE nb_restos = 1), 0),
        'clients_multi', coalesce(count(*) FILTER (WHERE nb_restos > 1), 0),
        'multi_pct', CASE WHEN count(*) > 0
          THEN round(100.0 * count(*) FILTER (WHERE nb_restos > 1) / count(*), 1) ELSE 0 END,
        'ca_total', coalesce(sum(ca), 0),
        'ca_multi', coalesce(sum(ca) FILTER (WHERE nb_restos > 1), 0),
        'ca_multi_pct', CASE WHEN coalesce(sum(ca), 0) > 0
          THEN round(100.0 * coalesce(sum(ca) FILTER (WHERE nb_restos > 1), 0) / sum(ca), 1) ELSE 0 END,
        'panier_mono', CASE WHEN coalesce(sum(commandes) FILTER (WHERE nb_restos = 1), 0) > 0
          THEN round(sum(ca) FILTER (WHERE nb_restos = 1) / sum(commandes) FILTER (WHERE nb_restos = 1), 2) ELSE 0 END,
        'panier_multi', CASE WHEN coalesce(sum(commandes) FILTER (WHERE nb_restos > 1), 0) > 0
          THEN round(sum(ca) FILTER (WHERE nb_restos > 1) / sum(commandes) FILTER (WHERE nb_restos > 1), 2) ELSE 0 END,
        'freq_mono', CASE WHEN count(*) FILTER (WHERE nb_restos = 1) > 0
          THEN round(1.0 * sum(commandes) FILTER (WHERE nb_restos = 1) / count(*) FILTER (WHERE nb_restos = 1), 2) ELSE 0 END,
        'freq_multi', CASE WHEN count(*) FILTER (WHERE nb_restos > 1) > 0
          THEN round(1.0 * sum(commandes) FILTER (WHERE nb_restos > 1) / count(*) FILTER (WHERE nb_restos > 1), 2) ELSE 0 END,
        'restaurants_moy', CASE WHEN count(*) > 0 THEN round(avg(nb_restos), 2) ELSE 0 END
      ) FROM cl
    ),
    'profils', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'profil', profil,
        'clients', clients,
        'commandes', commandes,
        'ca', ca,
        'panier_moyen', CASE WHEN commandes > 0 THEN round(ca / commandes, 2) ELSE 0 END
      ) ORDER BY tri)
      FROM profils
    ), '[]'::jsonb),
    'paires', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'resto_a', ra.name,
        'resto_b', rb.name,
        'clients_communs', p.clients_communs,
        'commandes', p.commandes,
        'ca', p.ca
      ) ORDER BY p.clients_communs DESC)
      FROM paires p
      JOIN public.restaurants ra ON ra.id = p.resto_a
      JOIN public.restaurants rb ON rb.id = p.resto_b
    ), '[]'::jsonb),
    'restaurants', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'restaurant_id', x.restaurant_id,
        'nom', r.name,
        'clients', x.clients,
        'clients_partages', x.clients_partages,
        'partage_pct', CASE WHEN x.clients > 0 THEN round(100.0 * x.clients_partages / x.clients, 1) ELSE 0 END,
        'commandes', x.commandes,
        'ca', x.ca,
        'ca_partage', coalesce(x.ca_partage, 0)
      ) ORDER BY x.clients_partages DESC)
      FROM par_resto x
      JOIN public.restaurants r ON r.id = x.restaurant_id
    ), '[]'::jsonb),
    'snapshot_at', now()
  )
$function$;

REVOKE ALL ON FUNCTION public.get_chataigne_cross_store(date, date, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_chataigne_cross_store(date, date, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_chataigne_cross_store(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chataigne_cross_store(date, date, uuid[]) TO service_role;