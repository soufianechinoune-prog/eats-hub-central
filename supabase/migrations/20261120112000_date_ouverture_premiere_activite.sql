-- Date d'ouverture réelle : la première activité, tous canaux confondus.
--
-- Constat du 20/11/2026 : first_activity_date prenait le premier jour de CAISSE dès qu'il existait.
-- Or l'historique caisse (Splash) commence parfois bien après l'ouverture. Exemples Tasty Crousty :
--   Nanterre : 1er jour caisse 09/04/2026, mais 2 975 commandes Uber dès avril 2025 ;
--   Melun 27/04/2026 (Uber dès mai 2025), Boulogne 28/01/2026 (Uber dès sept. 2025),
--   Aubervilliers 28/11/2025 (Uber dès avril 2025), Champs-sur-Marne 13/11/2025 (Uber dès mars 2025).
-- Conséquence : ces restaurants passaient pour des ouvertures récentes et sortaient du périmètre constant.
--
-- Nouvelle règle : la date la plus ancienne entre
--   - le premier jour de caisse avec du CA ;
--   - le premier jour Uber avec au moins 10 commandes (écarte les commandes de test avant ouverture) ;
--   - la première commande Deliveroo.
-- Les dates impossibles (avant 2015, ex. « an 1 ») sont ignorées.
-- Lancement nocturne automatique : créé dans 20261120120000_dates_ouverture_par_canal.sql (validé le 20/11/2026).
-- Sauvegarde des anciennes valeurs : restaurants_first_activity_backup_20261120.

CREATE TABLE IF NOT EXISTS public.restaurants_first_activity_backup_20261120 AS
  SELECT id, first_activity_date, first_activity_source, now() AS saved_at FROM public.restaurants;
ALTER TABLE public.restaurants_first_activity_backup_20261120 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurants_first_activity_backup_20261120 FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_restaurant_first_activity(p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  WITH target AS (
    SELECT id FROM public.restaurants
    WHERE p_restaurant_ids IS NULL OR id = ANY(p_restaurant_ids)
  ),
  cash AS (
    SELECT s.restaurant_id, MIN(s.date)::date AS d
    FROM public.splash360_daily_sales s
    JOIN target t ON t.id = s.restaurant_id
    WHERE COALESCE(s.revenue_ttc, 0) > 0 AND s.date >= '2015-01-01'
    GROUP BY s.restaurant_id
  ),
  uber AS (
    SELECT s.restaurant_id, MIN(s.day) AS d
    FROM public.orders_daily_summary s
    JOIN target t ON t.id = s.restaurant_id
    WHERE s.order_count >= 10 AND s.day >= '2015-01-01'
    GROUP BY s.restaurant_id
  ),
  delv AS (
    SELECT dv.restaurant_id, MIN((dv.delivery_datetime AT TIME ZONE 'Europe/Paris')::date) AS d
    FROM public.deliveroo_orders dv
    JOIN target t ON t.id = dv.restaurant_id
    WHERE dv.delivery_datetime >= '2015-01-01'
    GROUP BY dv.restaurant_id
  ),
  merged AS (
    SELECT t.id, c.d AS cash_d, u.d AS uber_d, v.d AS delv_d,
      LEAST(c.d, u.d, v.d) AS first_d
    FROM target t
    LEFT JOIN cash c ON c.restaurant_id = t.id
    LEFT JOIN uber u ON u.restaurant_id = t.id
    LEFT JOIN delv v ON v.restaurant_id = t.id
  )
  UPDATE public.restaurants r
  SET first_activity_date = m.first_d,
      first_activity_source = CASE
        WHEN m.cash_d = m.first_d THEN 'cash'
        WHEN m.uber_d = m.first_d THEN 'uber'
        ELSE 'deliveroo'
      END
  FROM merged m
  WHERE m.id = r.id
    AND m.first_d IS NOT NULL
    AND (r.first_activity_date IS DISTINCT FROM m.first_d
         OR r.first_activity_source IS DISTINCT FROM CASE WHEN m.cash_d = m.first_d THEN 'cash' WHEN m.uber_d = m.first_d THEN 'uber' ELSE 'deliveroo' END);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

SELECT public.refresh_restaurant_first_activity();

-- Remplacé par la tâche restaurant-dates-nightly (voir 20261120120000) :
-- SELECT cron.schedule('first-activity-nightly', '40 3 * * *', 'SELECT public.refresh_restaurant_first_activity()');
