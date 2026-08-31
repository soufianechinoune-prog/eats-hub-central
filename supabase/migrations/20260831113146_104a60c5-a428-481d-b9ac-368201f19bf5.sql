CREATE TABLE public.deliveroo_ads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  chain_id uuid REFERENCES public.chains(id),
  restaurant_id uuid REFERENCES public.restaurants(id),
  deliveroo_name text NOT NULL,
  normalized_name text,
  campaign_id text NOT NULL DEFAULT '',
  campaign_name text,
  campaign_status text,
  ad_spend numeric NOT NULL DEFAULT 0,
  ad_sales_clicks numeric NOT NULL DEFAULT 0,
  ad_orders_clicks numeric NOT NULL DEFAULT 0,
  clicks numeric NOT NULL DEFAULT 0,
  views numeric NOT NULL DEFAULT 0,
  avg_cpc numeric,
  source_file text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX deliveroo_ads_unique_idx
  ON public.deliveroo_ads (deliveroo_name, campaign_id, date);
CREATE INDEX deliveroo_ads_restaurant_date_idx
  ON public.deliveroo_ads (restaurant_id, date);

GRANT SELECT ON public.deliveroo_ads TO authenticated;
GRANT ALL ON public.deliveroo_ads TO service_role;

ALTER TABLE public.deliveroo_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view deliveroo ads of their chains"
ON public.deliveroo_ads FOR SELECT TO authenticated
USING (chain_id IS NOT NULL AND public.user_has_chain_access(chain_id));

CREATE TRIGGER update_deliveroo_ads_updated_at
BEFORE UPDATE ON public.deliveroo_ads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_deliveroo_profitability(
  p_start date,
  p_end date,
  p_restaurant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  restaurant_id uuid,
  restaurant_name text,
  ca numeric,
  commission numeric,
  orders_count bigint,
  pub numeric,
  ad_sales numeric,
  ad_orders numeric,
  food_cost numeric,
  marge numeric,
  marge_pct numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sales AS (
    SELECT o.restaurant_id,
           SUM(o.subtotal) AS ca,
           SUM(o.commission + COALESCE(o.commission_vat, 0)) AS commission,
           COUNT(*) AS orders_count
    FROM public.deliveroo_sales_orders o
    WHERE o.restaurant_id IS NOT NULL
      AND o.status = 'Terminée'
      AND (o.sent_at AT TIME ZONE 'Europe/Paris')::date BETWEEN p_start AND p_end
      AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
    GROUP BY o.restaurant_id
  ),
  ads AS (
    SELECT a.restaurant_id,
           SUM(a.ad_spend) AS pub,
           SUM(a.ad_sales_clicks) AS ad_sales,
           SUM(a.ad_orders_clicks) AS ad_orders
    FROM public.deliveroo_ads a
    WHERE a.restaurant_id IS NOT NULL
      AND a.date BETWEEN p_start AND p_end
      AND (p_restaurant_ids IS NULL OR a.restaurant_id = ANY(p_restaurant_ids))
    GROUP BY a.restaurant_id
  ),
  ids AS (
    SELECT restaurant_id FROM sales
    UNION
    SELECT restaurant_id FROM ads
  )
  SELECT
    i.restaurant_id,
    r.name AS restaurant_name,
    COALESCE(s.ca, 0) AS ca,
    COALESCE(s.commission, 0) AS commission,
    COALESCE(s.orders_count, 0) AS orders_count,
    COALESCE(ad.pub, 0) AS pub,
    COALESCE(ad.ad_sales, 0) AS ad_sales,
    COALESCE(ad.ad_orders, 0) AS ad_orders,
    0::numeric AS food_cost,
    COALESCE(s.ca, 0) - COALESCE(s.commission, 0) - COALESCE(ad.pub, 0) AS marge,
    CASE WHEN COALESCE(s.ca, 0) > 0
      THEN ROUND(((COALESCE(s.ca, 0) - COALESCE(s.commission, 0) - COALESCE(ad.pub, 0)) / s.ca) * 100, 2)
      ELSE NULL END AS marge_pct
  FROM ids i
  JOIN public.restaurants r ON r.id = i.restaurant_id
  LEFT JOIN sales s ON s.restaurant_id = i.restaurant_id
  LEFT JOIN ads ad ON ad.restaurant_id = i.restaurant_id
  WHERE public.user_has_chain_access(r.chain_id)
  ORDER BY COALESCE(s.ca, 0) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_deliveroo_profitability(date, date, uuid[]) TO authenticated, service_role;