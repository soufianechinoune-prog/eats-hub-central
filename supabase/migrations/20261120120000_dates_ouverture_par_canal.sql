-- Dates d'ouverture PAR CANAL (Uber Eats, caisse, Deliveroo), validé avec Soufiane le 20/11/2026.
--
-- Un restaurant n'ouvre pas tous ses canaux le même jour (caisse d'abord, Uber des mois après, ou
-- l'inverse). Et le premier jour de données n'est pas toujours une ouverture : c'est parfois juste le
-- début de notre historique.
--   - Villeneuve-la-Garenne : caisse « depuis le 01/02/2026 » = début de l'import caisse, déjà du CA ce jour-là.
--   - Goussainville : Uber « depuis le 24/05/2026 » = début de la récupération Uber pour ce restaurant.
--   - Bordeaux : caisse à 0 € du 01/02 au 08/02, CA à partir du 09/02/2026 = vraie ouverture.
--
-- Pour chaque canal :
--   <canal>_first_date     : premier jour d'activité (Uber : premier jour avec au moins 10 commandes)
--   <canal>_history_start  : début de nos données pour ce canal
--   <canal>_is_opening     : true si on a des données vides avant le premier jour (= vraie ouverture),
--                            false si l'activité commence dès le début de nos données (ouvert avant).
-- Début d'historique :
--   Uber      : premier mois récupéré avec succès (rapport de paiements), ou première commande si plus ancienne ;
--   caisse    : première ligne Splash reçue (même à 0 €) ;
--   Deliveroo : première commande Deliveroo de l'enseigne (imports CSV).
-- Les dates saisies à la main (uber_opening_date, deliveroo_opening_date) ne sont pas modifiées.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS uber_first_date date,
  ADD COLUMN IF NOT EXISTS uber_history_start date,
  ADD COLUMN IF NOT EXISTS uber_is_opening boolean,
  ADD COLUMN IF NOT EXISTS cash_first_date date,
  ADD COLUMN IF NOT EXISTS cash_history_start date,
  ADD COLUMN IF NOT EXISTS cash_is_opening boolean,
  ADD COLUMN IF NOT EXISTS deliveroo_first_date date,
  ADD COLUMN IF NOT EXISTS deliveroo_history_start date,
  ADD COLUMN IF NOT EXISTS deliveroo_is_opening boolean,
  ADD COLUMN IF NOT EXISTS channel_dates_refreshed_at timestamptz;

CREATE OR REPLACE FUNCTION public.refresh_restaurant_channel_dates(p_restaurant_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_count integer;
BEGIN
  WITH target AS (
    SELECT id, chain_id FROM public.restaurants
    WHERE p_restaurant_ids IS NULL OR id = ANY(p_restaurant_ids)
  ),
  cash AS (
    SELECT s.restaurant_id,
      MIN(s.date)::date AS hist,
      MIN(s.date) FILTER (WHERE COALESCE(s.revenue_ttc, 0) > 0)::date AS first_d
    FROM public.splash360_daily_sales s JOIN target t ON t.id = s.restaurant_id
    WHERE s.date >= '2015-01-01'
    GROUP BY s.restaurant_id
  ),
  uber_orders AS (
    SELECT s.restaurant_id,
      MIN(s.day) AS first_any,
      MIN(s.day) FILTER (WHERE s.order_count >= 10) AS first_d
    FROM public.orders_daily_summary s JOIN target t ON t.id = s.restaurant_id
    WHERE s.day >= '2015-01-01' AND s.order_count > 0
    GROUP BY s.restaurant_id
  ),
  uber_backfill AS (
    SELECT b.restaurant_id, MIN(b.month_start)::date AS hist
    FROM public.backfill_jobs b JOIN target t ON t.id = b.restaurant_id
    WHERE b.report_type = 'PAYMENT_DETAILS_REPORT' AND b.status = 'done'
    GROUP BY b.restaurant_id
  ),
  delv AS (
    SELECT dv.restaurant_id, MIN((dv.delivery_datetime AT TIME ZONE 'Europe/Paris')::date) AS first_d
    FROM public.deliveroo_orders dv JOIN target t ON t.id = dv.restaurant_id
    WHERE dv.delivery_datetime >= '2015-01-01'
    GROUP BY dv.restaurant_id
  ),
  delv_chain AS (
    SELECT r.chain_id, MIN((dv.delivery_datetime AT TIME ZONE 'Europe/Paris')::date) AS hist
    FROM public.deliveroo_orders dv JOIN public.restaurants r ON r.id = dv.restaurant_id
    WHERE dv.delivery_datetime >= '2015-01-01'
    GROUP BY r.chain_id
  ),
  merged AS (
    SELECT t.id,
      c.first_d AS cash_first, c.hist AS cash_hist,
      u.first_d AS uber_first, u.first_any AS uber_any,
      LEAST(ub.hist, u.first_any) AS uber_hist,
      d.first_d AS delv_first, dc.hist AS delv_hist
    FROM target t
    LEFT JOIN cash c ON c.restaurant_id = t.id
    LEFT JOIN uber_orders u ON u.restaurant_id = t.id
    LEFT JOIN uber_backfill ub ON ub.restaurant_id = t.id
    LEFT JOIN delv d ON d.restaurant_id = t.id
    LEFT JOIN delv_chain dc ON dc.chain_id = t.chain_id
  )
  UPDATE public.restaurants r SET
    cash_first_date = m.cash_first,
    cash_history_start = m.cash_hist,
    cash_is_opening = CASE WHEN m.cash_first IS NULL THEN NULL ELSE m.cash_first > m.cash_hist END,
    uber_first_date = COALESCE(m.uber_first, m.uber_any),
    uber_history_start = m.uber_hist,
    -- marge de 3 jours : une commande isolée juste avant le début de l'historique ne compte pas
    uber_is_opening = CASE WHEN m.uber_any IS NULL THEN NULL ELSE m.uber_any > m.uber_hist + 3 END,
    deliveroo_first_date = m.delv_first,
    deliveroo_history_start = m.delv_hist,
    deliveroo_is_opening = CASE WHEN m.delv_first IS NULL THEN NULL ELSE m.delv_first > m.delv_hist + 7 END,
    channel_dates_refreshed_at = now()
  FROM merged m
  WHERE m.id = r.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

SELECT public.refresh_restaurant_channel_dates();

-- Chaque nuit à 03:40 (après ods_nightly de 03:15) : dates par canal + première activité globale.
SELECT cron.schedule('restaurant-dates-nightly', '40 3 * * *',
  'SELECT public.refresh_restaurant_channel_dates(); SELECT public.refresh_restaurant_first_activity();');
