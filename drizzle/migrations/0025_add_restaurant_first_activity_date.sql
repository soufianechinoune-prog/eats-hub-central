-- Additive: date de première activité réelle détectée automatiquement
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS first_activity_date date,
  ADD COLUMN IF NOT EXISTS first_activity_source text;

COMMENT ON COLUMN public.restaurants.first_activity_date IS 'Date de première activité réelle constatée (caisse Splash en priorité, sinon Uber/Deliveroo). Calculée automatiquement.';
COMMENT ON COLUMN public.restaurants.first_activity_source IS 'Origine de first_activity_date: cash | uber | deliveroo';

-- Backfill: caisse (Splash) = source de référence
WITH cash AS (
  SELECT restaurant_id, MIN(date)::date AS d
  FROM public.splash360_daily_sales
  WHERE COALESCE(revenue_ttc, 0) > 0
  GROUP BY restaurant_id
),
uber AS (
  SELECT restaurant_id, MIN((order_datetime AT TIME ZONE 'Europe/Paris')::date) AS d
  FROM public.orders
  GROUP BY restaurant_id
),
delv AS (
  SELECT restaurant_id, MIN((delivery_datetime AT TIME ZONE 'Europe/Paris')::date) AS d
  FROM public.deliveroo_orders
  GROUP BY restaurant_id
),
merged AS (
  SELECT r.id,
         c.d AS cash_d,
         u.d AS uber_d,
         v.d AS delv_d
  FROM public.restaurants r
  LEFT JOIN cash c ON c.restaurant_id = r.id
  LEFT JOIN uber u ON u.restaurant_id = r.id
  LEFT JOIN delv v ON v.restaurant_id = r.id
)
UPDATE public.restaurants r
SET first_activity_date = COALESCE(m.cash_d, LEAST(COALESCE(m.uber_d, m.delv_d), COALESCE(m.delv_d, m.uber_d))),
    first_activity_source = CASE
      WHEN m.cash_d IS NOT NULL THEN 'cash'
      WHEN m.uber_d IS NOT NULL AND (m.delv_d IS NULL OR m.uber_d <= m.delv_d) THEN 'uber'
      WHEN m.delv_d IS NOT NULL THEN 'deliveroo'
      ELSE NULL
    END
FROM merged m
WHERE m.id = r.id
  AND COALESCE(m.cash_d, m.uber_d, m.delv_d) IS NOT NULL;

-- Fonction de rafraîchissement (à appeler après un import / backfill)
CREATE OR REPLACE FUNCTION public.refresh_restaurant_first_activity(p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    WHERE COALESCE(s.revenue_ttc, 0) > 0
    GROUP BY s.restaurant_id
  ),
  uber AS (
    SELECT o.restaurant_id, MIN((o.order_datetime AT TIME ZONE 'Europe/Paris')::date) AS d
    FROM public.orders o
    JOIN target t ON t.id = o.restaurant_id
    GROUP BY o.restaurant_id
  ),
  delv AS (
    SELECT dv.restaurant_id, MIN((dv.delivery_datetime AT TIME ZONE 'Europe/Paris')::date) AS d
    FROM public.deliveroo_orders dv
    JOIN target t ON t.id = dv.restaurant_id
    GROUP BY dv.restaurant_id
  ),
  merged AS (
    SELECT t.id, c.d AS cash_d, u.d AS uber_d, v.d AS delv_d
    FROM target t
    LEFT JOIN cash c ON c.restaurant_id = t.id
    LEFT JOIN uber u ON u.restaurant_id = t.id
    LEFT JOIN delv v ON v.restaurant_id = t.id
  )
  UPDATE public.restaurants r
  SET first_activity_date = COALESCE(m.cash_d, LEAST(COALESCE(m.uber_d, m.delv_d), COALESCE(m.delv_d, m.uber_d))),
      first_activity_source = CASE
        WHEN m.cash_d IS NOT NULL THEN 'cash'
        WHEN m.uber_d IS NOT NULL AND (m.delv_d IS NULL OR m.uber_d <= m.delv_d) THEN 'uber'
        WHEN m.delv_d IS NOT NULL THEN 'deliveroo'
        ELSE NULL
      END
  FROM merged m
  WHERE m.id = r.id
    AND COALESCE(m.cash_d, m.uber_d, m.delv_d) IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_restaurant_first_activity(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_restaurant_first_activity(uuid[]) TO service_role;