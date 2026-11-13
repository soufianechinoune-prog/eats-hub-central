-- Pub Uber : passage TTC -> HT + simulateur de budget pub (13/11/2026). Idempotente.
--
-- 1. Les montants de pub des versements Uber viennent de la colonne
--    « Autres paiements (TVA incluse) » : ils sont TTC (vérifié ancienne et nouvelle source).
--    Le contrat Uber et la page « Pub HT » raisonnent en HT -> on divise par 1,2 (TVA 20 %).
DO $$
DECLARE f text; d text; d2 text;
BEGIN
  FOREACH f IN ARRAY ARRAY['get_ads_efficiency','get_ads_quarterly_summary','get_ads_revenue_ratio','get_ads_revenue_ratio_modes'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = f;
    IF d IS NULL OR d LIKE '%/*TTC->HT*/%' THEN CONTINUE; END IF;
    d2 := replace(d, 'SUM(pa.amount)', '(SUM(pa.amount) / 1.2 /*TTC->HT*/)');
    IF d2 <> d THEN EXECUTE d2; END IF;
  END LOOP;
END $$;

-- 2. Règles du contrat Uber par enseigne (aucune règle = aucune alerte contrat).
CREATE TABLE IF NOT EXISTS public.ads_contract_rules (
  chain_id uuid PRIMARY KEY REFERENCES public.chains(id) ON DELETE CASCADE,
  label text NOT NULL,
  min_ads_ratio numeric NOT NULL,          -- pub HT des franchisés ÷ CA net Uber TTC
  hq_extra_rate numeric NOT NULL DEFAULT 0, -- surcoût siège (part du CA) si le ratio passe sous le seuil
  growth_penalty_eur numeric,              -- coût annuel estimé si la croissance passe sous 0 %
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ads_contract_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ads_contract_rules_read ON public.ads_contract_rules;
CREATE POLICY ads_contract_rules_read ON public.ads_contract_rules FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.user_has_chain_access(chain_id));
DROP POLICY IF EXISTS ads_contract_rules_admin ON public.ads_contract_rules;
CREATE POLICY ads_contract_rules_admin ON public.ads_contract_rules FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Contrat Uber Chicken Street (en vigueur 01/07/2026, art. IX.A.7 et IX.F) :
-- ratio franchisés < 3 % -> siège 0,75 % du CA au lieu de 0,65 % ; croissance < 0 % -> +1 pt au lieu de +0,5 pt.
INSERT INTO public.ads_contract_rules (chain_id, label, min_ads_ratio, hq_extra_rate, growth_penalty_eur)
SELECT id, 'Contrat Uber 2026', 0.03, 0.001, 140000 FROM public.chains WHERE name = 'Chicken Street'
ON CONFLICT (chain_id) DO NOTHING;

-- 3. Données du simulateur : par restaurant d'UNE enseigne, moyennes hebdomadaires
--    sur les 12 dernières semaines consolidées (la pub arrive en ~14 jours).
CREATE OR REPLACE FUNCTION public.get_ads_budget_simulator(p_chain_id uuid)
RETURNS TABLE(restaurant_id uuid, restaurant_name text, weeks integer, revenue_week numeric, ads_week_ht numeric, payout_ratio numeric, period_start date, period_end date)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '20s'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_end date;
  v_start date;
BEGIN
  IF p_chain_id IS NULL OR NOT (public.is_super_admin() OR public.user_has_chain_access(p_chain_id)) THEN RETURN; END IF;
  -- dernier dimanche dont la pub est consolidée (fin de semaine + 14 jours <= aujourd'hui)
  v_end := v_today - 14;
  v_end := v_end - (EXTRACT(ISODOW FROM v_end)::int % 7);
  v_start := v_end - 83;  -- 12 semaines complètes, lundi -> dimanche
  RETURN QUERY
  WITH s AS (
    SELECT o.restaurant_id rid, COUNT(DISTINCT date_trunc('week', o.day)) nw,
           SUM(o.sales_incl_vat - o.item_promo_incl_vat_abs) ca, SUM(o.net_payout + o.meal_voucher) pay
    FROM public.orders_daily_summary o JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE r.chain_id = p_chain_id AND o.day BETWEEN v_start AND v_end
    GROUP BY 1
  ), a AS (
    SELECT pa.restaurant_id rid, ABS(SUM(pa.amount)) / 1.2 ads_ht
    FROM public.ads_advertising_lines pa JOIN public.restaurants r ON r.id = pa.restaurant_id
    WHERE r.chain_id = p_chain_id
      AND pa.payout_date BETWEEN v_start AND v_end + 1
      AND public.ads_reporting_date(pa.payout_date) BETWEEN v_start AND v_end
    GROUP BY 1
  )
  SELECT r.id, r.name, s.nw::int, ROUND(s.ca / s.nw, 2), ROUND(COALESCE(a.ads_ht, 0) / s.nw, 2),
         ROUND(s.pay / NULLIF(s.ca, 0), 4), v_start, v_end
  FROM s JOIN public.restaurants r ON r.id = s.rid LEFT JOIN a ON a.rid = s.rid
  WHERE r.is_active AND s.nw >= 6 AND s.ca / s.nw > 500 AND s.pay > 0
  ORDER BY r.name;
END $function$;

REVOKE ALL ON FUNCTION public.get_ads_budget_simulator(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_ads_budget_simulator(uuid) TO authenticated;
