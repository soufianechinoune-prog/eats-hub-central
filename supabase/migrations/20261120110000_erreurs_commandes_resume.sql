-- Commandes incorrectes : compter côté base au lieu de télécharger les lignes d'erreur.
--
-- Constat du 20/11/2026 (Chicken Street, 2026) :
-- - order_errors contient 62 767 lignes (une par article en erreur), soit 42 476 commandes, 575 939 € d'impact ;
-- - la Vue d'ensemble et la page « Comparaison Commandes incorrectes » téléchargeaient ces lignes, mais l'API
--   n'en rend que 1 000 → carte à 0,1 % au lieu de 3,5 % ;
-- - le tableau des restaurants lisait daily_order_accuracy, vide pour toutes les enseignes → 0,0 % partout.
--
-- get_order_errors_summary renvoie, par restaurant (journée de service, comme le nombre de commandes) :
--   level = 'total'    : commandes distinctes en erreur, lignes d'erreur, impact financier ;
--   level = 'weekday'  : idem par jour de semaine (0 = dimanche, comme getDay() en JavaScript) ;
--   level = 'category' : idem par catégorie d'erreur.
-- Accès à l'enseigne vérifié une fois par restaurant.

CREATE INDEX IF NOT EXISTS idx_order_errors_restaurant_date ON public.order_errors (restaurant_id, error_date);

CREATE OR REPLACE FUNCTION public.get_order_errors_summary(p_restaurant_ids uuid[], p_start_date date, p_end_date date)
 RETURNS TABLE(restaurant_id uuid, level text, weekday integer, category text, error_orders bigint, error_lines bigint, financial_impact numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '15s'
AS $function$
  WITH ids AS (
    SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) AS a FROM public.restaurants r
    WHERE r.id = ANY(p_restaurant_ids) AND public.user_has_chain_access(r.chain_id)
  ), e AS (
    SELECT x.restaurant_id, x.uber_order_id, COALESCE(x.financial_impact, 0) AS impact,
      COALESCE(NULLIF(x.error_category, ''), 'Autre') AS category,
      public.ods_business_day(x.error_date) AS day
    FROM public.order_errors x
    WHERE x.restaurant_id = ANY((SELECT a FROM ids)::uuid[])
      -- marge d'un jour de chaque côté, puis filtre exact sur la journée de service
      AND x.error_date >= (p_start_date - 1)::timestamp AT TIME ZONE 'Europe/Paris'
      AND x.error_date < (p_end_date + 2)::timestamp AT TIME ZONE 'Europe/Paris'
  )
  SELECT e.restaurant_id,
    CASE WHEN GROUPING(EXTRACT(DOW FROM e.day)) = 0 THEN 'weekday'
         WHEN GROUPING(e.category) = 0 THEN 'category' ELSE 'total' END,
    CASE WHEN GROUPING(EXTRACT(DOW FROM e.day)) = 0 THEN EXTRACT(DOW FROM e.day)::integer END,
    CASE WHEN GROUPING(e.category) = 0 THEN e.category END,
    COUNT(DISTINCT e.uber_order_id), COUNT(*), ROUND(SUM(e.impact)::numeric, 2)
  FROM e
  WHERE e.day BETWEEN p_start_date AND p_end_date
  GROUP BY GROUPING SETS ((e.restaurant_id), (e.restaurant_id, EXTRACT(DOW FROM e.day)), (e.restaurant_id, e.category))
  ORDER BY 1, 2, 3, 4;
$function$;

REVOKE ALL ON FUNCTION public.get_order_errors_summary(uuid[], date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_order_errors_summary(uuid[], date, date) TO authenticated, service_role;
