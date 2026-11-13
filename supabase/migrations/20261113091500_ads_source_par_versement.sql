-- Correction pub Uber (13/11/2026) — déjà appliquée en production le 13/11/2026.
-- Idempotente : peut être rejouée sans effet.
--
-- Problème : les 4 fonctions pub lisaient uniquement payout_adjustments (legacy).
--   - Versements du 19/10 et 26/10 : la contrainte legacy n'a gardé qu'une ligne
--     « Dépenses publicitaires » par versement (≈ 1 jour sur 7).
--   - Depuis le 31/10 : parse-payment-report n'écrit plus que dans
--     payout_adjustment_lines → 0 € de pub affiché.
-- Règle : PAR VERSEMENT (restaurant + payout_reference_id), on lit
-- payout_adjustment_lines si le versement y existe, sinon payout_adjustments.
-- (Pas de bascule par date : la nouvelle table ne couvre que quelques restos
-- avant le 12/10.)

CREATE OR REPLACE VIEW public.ads_advertising_lines WITH (security_invoker = true) AS
SELECT l.restaurant_id, l.payout_reference_id, l.payout_date, l.amount, l.category, 'raw'::text AS source_kind
FROM public.payout_adjustment_lines l
WHERE l.category = 'advertising' AND l.source_duplicate_of IS NULL
UNION ALL
SELECT a.restaurant_id, a.payout_reference_id, a.payout_date, a.amount, a.category, 'legacy'::text
FROM public.payout_adjustments a
WHERE a.category = 'advertising'
  AND NOT EXISTS (SELECT 1 FROM public.payout_adjustment_lines l2
                  WHERE l2.restaurant_id = a.restaurant_id
                    AND l2.payout_reference_id = a.payout_reference_id
                    AND l2.source_duplicate_of IS NULL);

COMMENT ON VIEW public.ads_advertising_lines IS 'Pub Uber : payout_adjustment_lines quand le versement y existe, sinon payout_adjustments (legacy). Règle par versement. Correction du 13/11/2026.';
REVOKE ALL ON public.ads_advertising_lines FROM anon, authenticated;

DO $$
DECLARE f text; d text; d2 text;
BEGIN
  FOREACH f IN ARRAY ARRAY['get_ads_efficiency','get_ads_quarterly_summary','get_ads_revenue_ratio','get_ads_revenue_ratio_modes'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = f;
    IF d IS NULL OR d LIKE '%ads_advertising_lines pa%' THEN CONTINUE; END IF;
    d2 := replace(replace(d, 'public.payout_adjustments pa', 'public.ads_advertising_lines pa'),
                  'FROM payout_adjustments pa', 'FROM public.ads_advertising_lines pa');
    IF d2 <> d THEN EXECUTE d2; END IF;
  END LOOP;
END $$;

-- Rollback : remplacer 'public.ads_advertising_lines pa' par 'public.payout_adjustments pa'
-- dans les 4 fonctions (même boucle DO), puis DROP VIEW public.ads_advertising_lines.
