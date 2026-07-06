
-- Weekly reports history
CREATE TABLE public.weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  xlsx_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_to TEXT[] DEFAULT ARRAY[]::TEXT[],
  sent_at TIMESTAMPTZ,
  totals JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_reports TO authenticated;
GRANT ALL ON public.weekly_reports TO service_role;

ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view weekly reports of accessible chains"
ON public.weekly_reports FOR SELECT TO authenticated
USING (public.user_has_chain_access(chain_id));

CREATE POLICY "Users insert weekly reports for accessible chains"
ON public.weekly_reports FOR INSERT TO authenticated
WITH CHECK (public.user_has_chain_access(chain_id));

CREATE POLICY "Users update weekly reports for accessible chains"
ON public.weekly_reports FOR UPDATE TO authenticated
USING (public.user_has_chain_access(chain_id));

CREATE POLICY "Users delete weekly reports for accessible chains"
ON public.weekly_reports FOR DELETE TO authenticated
USING (public.user_has_chain_access(chain_id));

-- Recipients configurable per chain
CREATE TABLE public.weekly_report_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_report_recipients TO authenticated;
GRANT ALL ON public.weekly_report_recipients TO service_role;

ALTER TABLE public.weekly_report_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage recipients for accessible chains"
ON public.weekly_report_recipients FOR ALL TO authenticated
USING (public.user_has_chain_access(chain_id))
WITH CHECK (public.user_has_chain_access(chain_id));

-- Aggregation RPC (source: orders table, TZ Paris)
CREATE OR REPLACE FUNCTION public.get_weekly_uber_report(
  p_chain_id UUID,
  p_week_start DATE,
  p_week_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  IF NOT public.user_has_chain_access(p_chain_id) THEN
    RAISE EXCEPTION 'Access denied for chain %', p_chain_id;
  END IF;

  v_start := (p_week_start::TIMESTAMP AT TIME ZONE 'Europe/Paris');
  v_end := ((p_week_end + 1)::TIMESTAMP AT TIME ZONE 'Europe/Paris');

  WITH base AS (
    SELECT
      o.id,
      o.restaurant_id,
      r.name AS restaurant_name,
      (o.order_datetime AT TIME ZONE 'Europe/Paris')::DATE AS local_date,
      COALESCE(o.sales_incl_vat, 0)::NUMERIC AS ca_brut_ttc,
      COALESCE(o.sales_excl_vat, 0)::NUMERIC AS ca_brut_ht,
      COALESCE(o.item_promo_incl_vat, 0)::NUMERIC AS promo_ttc,
      COALESCE(o.item_promo_excl_vat, 0)::NUMERIC AS promo_ht,
      COALESCE(o.uber_fee_after_promo_incl_vat, 0)::NUMERIC AS fee_ttc,
      COALESCE(o.uber_fee_after_promo_excl_vat, 0)::NUMERIC AS fee_ht,
      COALESCE(o.marketing_fee_incl_vat, 0)::NUMERIC AS mkt_ttc,
      COALESCE(o.marketing_fee_excl_vat, 0)::NUMERIC AS mkt_ht,
      COALESCE(o.uber_service_fee_incl_vat, 0)::NUMERIC AS svc_ttc,
      COALESCE(o.uber_service_fee_excl_vat, 0)::NUMERIC AS svc_ht,
      COALESCE(o.net_payout, 0)::NUMERIC AS payout,
      COALESCE(o.meal_voucher_amount, 0)::NUMERIC AS meal_voucher
    FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE r.chain_id = p_chain_id
      AND o.order_datetime >= v_start
      AND o.order_datetime < v_end
      AND COALESCE(o.status, '') NOT ILIKE '%cancel%'
  ),
  network_total AS (
    SELECT
      COUNT(*) AS orders_count,
      SUM(ca_brut_ttc) AS ca_brut_ttc,
      SUM(ca_brut_ht) AS ca_brut_ht,
      SUM(ca_brut_ttc - fee_ttc) AS ca_net_ttc,
      SUM(ca_brut_ht - fee_ht) AS ca_net_ht,
      SUM(fee_ttc) AS commission_uber,
      SUM(mkt_ttc) AS marketing_fee,
      SUM(svc_ttc) AS service_fee,
      SUM(payout + meal_voucher) AS payout_total
    FROM base
  ),
  by_day AS (
    SELECT
      local_date,
      COUNT(*) AS orders_count,
      SUM(ca_brut_ttc) AS ca_brut_ttc,
      SUM(ca_brut_ht) AS ca_brut_ht,
      SUM(ca_brut_ttc - fee_ttc) AS ca_net_ttc,
      SUM(ca_brut_ht - fee_ht) AS ca_net_ht,
      SUM(fee_ttc) AS commission_uber,
      SUM(mkt_ttc) AS marketing_fee,
      SUM(svc_ttc) AS service_fee,
      SUM(payout + meal_voucher) AS payout_total
    FROM base
    GROUP BY local_date
    ORDER BY local_date
  ),
  by_resto AS (
    SELECT
      restaurant_id,
      restaurant_name,
      COUNT(*) AS orders_count,
      SUM(ca_brut_ttc) AS ca_brut_ttc,
      SUM(ca_brut_ht) AS ca_brut_ht,
      SUM(ca_brut_ttc - fee_ttc) AS ca_net_ttc,
      SUM(ca_brut_ht - fee_ht) AS ca_net_ht,
      SUM(fee_ttc) AS commission_uber,
      SUM(mkt_ttc) AS marketing_fee,
      SUM(svc_ttc) AS service_fee,
      SUM(payout + meal_voucher) AS payout_total
    FROM base
    GROUP BY restaurant_id, restaurant_name
    ORDER BY restaurant_name
  ),
  by_day_resto AS (
    SELECT
      local_date,
      restaurant_id,
      restaurant_name,
      COUNT(*) AS orders_count,
      SUM(ca_brut_ttc) AS ca_brut_ttc,
      SUM(ca_brut_ht) AS ca_brut_ht,
      SUM(ca_brut_ttc - fee_ttc) AS ca_net_ttc,
      SUM(ca_brut_ht - fee_ht) AS ca_net_ht,
      SUM(fee_ttc) AS commission_uber,
      SUM(mkt_ttc) AS marketing_fee,
      SUM(svc_ttc) AS service_fee,
      SUM(payout + meal_voucher) AS payout_total
    FROM base
    GROUP BY local_date, restaurant_id, restaurant_name
    ORDER BY local_date, restaurant_name
  )
  SELECT jsonb_build_object(
    'network', (SELECT to_jsonb(network_total) FROM network_total),
    'by_day', COALESCE((SELECT jsonb_agg(to_jsonb(by_day)) FROM by_day), '[]'::jsonb),
    'by_restaurant', COALESCE((SELECT jsonb_agg(to_jsonb(by_resto)) FROM by_resto), '[]'::jsonb),
    'by_day_restaurant', COALESCE((SELECT jsonb_agg(to_jsonb(by_day_resto)) FROM by_day_resto), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_uber_report(UUID, DATE, DATE) TO authenticated, service_role;

CREATE TRIGGER trg_weekly_reports_updated_at
BEFORE UPDATE ON public.weekly_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
