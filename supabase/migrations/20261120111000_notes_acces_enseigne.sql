-- Notes clients : get_network_ratings_summary ne vérifiait pas l'accès à l'enseigne
-- (n'importe quel compte connecté pouvait lire les notes de n'importe quel restaurant).
-- Même résultat qu'avant pour un utilisateur autorisé ; accès vérifié une fois par restaurant.

CREATE OR REPLACE FUNCTION public.get_network_ratings_summary(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
 RETURNS TABLE(restaurant_id uuid, avg_rating numeric, review_count bigint, platform text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '10s'
AS $function$
  WITH ids AS (
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a FROM public.restaurants r
    WHERE r.id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
  )
  SELECT
    cr.restaurant_id,
    ROUND(AVG(cr.overall_rating)::numeric, 2) as avg_rating,
    COUNT(*) as review_count,
    cr.platform
  FROM public.customer_reviews cr
  WHERE cr.restaurant_id = ANY((SELECT a FROM ids)::uuid[])
    AND cr.review_date >= p_start_date
    AND cr.review_date <= p_end_date
    AND cr.overall_rating IS NOT NULL
  GROUP BY cr.restaurant_id, cr.platform;
$function$;
