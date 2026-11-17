-- Éco-contribution : une seule source, ligne à ligne quand c'est possible, et chaque ligne qualifiée.
--
-- Ce que dit le relevé Uber (libellés visibles dans Uber Manager, perdus dans l'export CSV où tout
-- s'appelle « Autres frais ») :
--   « Éco-contribution du 22/06/2026 au 28/06/2026 : 423 commandes x 0,1829 EUR »            -77,37 €
--   « Remboursement éco-contribution du 22/06/2026 au 28/06/2026 : 423 commandes x 0,1829 EUR » +77,37 €
--   « Annulation remboursement commande #0A44E PV »                                            +3,80 €
-- Donc :
--   - un prélèvement = un nombre de commandes × le taux (0,1829 € TTC en 2026 ; 0,1381 € puis 0,1363 € en 2025) ;
--   - un remboursement = le miroir exact d'un prélèvement : même période, même nombre de commandes,
--     donc même montant au centime. Il n'y a aucun montant minimum : un petit restaurant est remboursé
--     de petites sommes, et c'est quand même un vrai remboursement ;
--   - les autres crédits (commande annulée, annulation de remboursement client, titres-restaurant)
--     n'ont rien à voir avec l'éco-contribution, même s'ils tombent parfois par hasard sur un multiple du taux.
--
-- 1) Source par versement : si l'éco-contribution du versement existe ligne à ligne (payout_adjustment_lines),
--    on prend ces lignes ; sinon l'ancienne table (payout_adjustments), qui regroupe les lignes d'un même
--    versement en un seul montant. Jamais les deux. L'ancienne table n'est plus alimentée depuis fin
--    octobre 2026 : sans cela, novembre manquait.
--
-- 2) Nature de chaque ligne (eco_kind) :
--      hors_eco      : le montant est en fait dans la colonne « Titre-restaurant » ;
--      prelevement   : montant négatif ;
--      remboursement : crédit miroir d'un prélèvement du même restaurant (même montant au centime),
--                      ou crédit multiple du taux reçu dans le même versement qu'un crédit miroir
--                      (Uber rembourse par vagues ; notre historique des prélèvements est incomplet) ;
--      ajustement    : tout autre crédit isolé.
--    Lignes regroupées de l'ancienne table (on ne peut pas les décomposer) : comptées en remboursement
--    si elles valent au moins un quart d'une semaine type de prélèvement de ce restaurant, sinon en ajustement.
--    Ce repli disparaît à mesure que les versements sont réimportés ligne à ligne.

DROP VIEW IF EXISTS public.eco_contribution_lines;
CREATE VIEW public.eco_contribution_lines WITH (security_invoker = true) AS
WITH raw_lines AS (
  -- Une même ligne arrive parfois par deux rapports Uber différents sans être marquée en doublon :
  -- pour un même restaurant, versement, montant et date de commande, on ne garde que le premier rapport.
  SELECT l.id, l.restaurant_id, l.restaurant_name, l.payout_reference_id, l.payout_date, l.description,
         l.amount, l.raw_columns,
         dense_rank() OVER (
           PARTITION BY l.restaurant_id, l.payout_reference_id, round(l.amount, 2), coalesce(l.raw_columns->>'Date de la commande', '')
           ORDER BY l.source_report_hash NULLS FIRST) AS report_rank
  FROM public.payout_adjustment_lines l
  WHERE l.category = 'eco_contribution' AND l.source_duplicate_of IS NULL
),
src AS (
  SELECT r.id, r.restaurant_id, r.restaurant_name, r.payout_reference_id, r.payout_date, r.description,
         r.amount, r.raw_columns, 'raw'::text AS source_kind
  FROM raw_lines r WHERE r.report_rank = 1
  UNION ALL
  SELECT a.id, a.restaurant_id, a.restaurant_name, a.payout_reference_id, a.payout_date, a.description,
         a.amount, a.raw_columns, 'legacy'::text AS source_kind
  FROM public.payout_adjustments a
  WHERE a.category = 'eco_contribution'
    AND NOT EXISTS (
      SELECT 1 FROM public.payout_adjustment_lines l2
      WHERE l2.restaurant_id = a.restaurant_id AND l2.payout_reference_id = a.payout_reference_id
        AND l2.category = 'eco_contribution' AND l2.source_duplicate_of IS NULL)
),
parsed AS (
  SELECT s.id, s.restaurant_id, s.restaurant_name, s.payout_reference_id, s.payout_date, s.description, s.amount, s.source_kind,
    CASE WHEN s.raw_columns->>'Titre-restaurant' ~ '^-?\d+(\.\d+)?$' THEN (s.raw_columns->>'Titre-restaurant')::numeric END AS raw_titre,
    CASE WHEN s.raw_columns->>'Autres paiements (TVA incluse)' ~ '^-?\d+(\.\d+)?$' THEN (s.raw_columns->>'Autres paiements (TVA incluse)')::numeric END AS raw_autres,
    CASE WHEN s.raw_columns->>'Montant total' ~ '^-?\d+(\.\d+)?$' THEN (s.raw_columns->>'Montant total')::numeric END AS raw_total,
    LEAST(
      abs(abs(s.amount) - round(abs(s.amount) / 0.1829) * 0.1829),
      abs(abs(s.amount) - round(abs(s.amount) / 0.1381) * 0.1381),
      abs(abs(s.amount) - round(abs(s.amount) / 0.1363) * 0.1363)
    ) AS rate_residual
  FROM src s
),
flagged AS (
  SELECT p.*,
    -- Ligne isolée : ligne brute, ou ligne de l'ancienne table dont le montant est celui de sa ligne d'origine.
    (p.source_kind = 'raw' OR abs(p.amount - coalesce(p.raw_total, p.amount + 1)) <= 0.005) AS is_single_line,
    (p.rate_residual <= 0.0051) AS is_rate_multiple
  FROM parsed p
),
typed AS (
  SELECT f.*, (f.is_single_line AND coalesce(f.raw_titre, 0) <> 0 AND coalesce(f.raw_autres, 0) = 0) AS is_meal_voucher
  FROM flagged f
),
charges AS (
  SELECT t.restaurant_id, t.payout_date, round(-t.amount, 2) AS cents_amount
  FROM typed t WHERE t.amount < 0 AND NOT t.is_meal_voucher
),
typical AS (
  -- Semaine type de prélèvement du restaurant (on ignore les prélèvements de moins d'un euro).
  SELECT c.restaurant_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY c.cents_amount) AS typical_week
  FROM charges c WHERE c.cents_amount >= 1 GROUP BY c.restaurant_id
),
mirrored AS (
  SELECT t.*,
    (t.amount > 0 AND EXISTS (
      SELECT 1 FROM charges c
      WHERE c.restaurant_id = t.restaurant_id AND c.cents_amount = round(t.amount, 2) AND c.payout_date <= t.payout_date)) AS is_mirror
  FROM typed t
),
waved AS (
  SELECT m.*, bool_or(m.is_mirror) OVER (PARTITION BY m.restaurant_id, m.payout_reference_id) AS in_refund_wave
  FROM mirrored m
)
SELECT w.id, w.restaurant_id, w.restaurant_name, w.payout_reference_id, w.payout_date, w.description,
       w.amount, w.source_kind, w.is_single_line, w.is_rate_multiple, w.is_mirror,
       CASE
         WHEN w.is_meal_voucher THEN 'hors_eco'
         WHEN w.amount < 0 THEN 'prelevement'
         WHEN w.is_single_line AND (w.is_mirror OR (w.is_rate_multiple AND w.in_refund_wave)) THEN 'remboursement'
         WHEN w.is_single_line THEN 'ajustement'
         WHEN ty.typical_week IS NOT NULL AND w.amount >= 0.25 * ty.typical_week THEN 'remboursement'
         ELSE 'ajustement'
       END AS eco_kind
FROM waved w
LEFT JOIN typical ty ON ty.restaurant_id = w.restaurant_id;

GRANT SELECT ON public.eco_contribution_lines TO authenticated, service_role;
REVOKE ALL ON public.eco_contribution_lines FROM anon;
