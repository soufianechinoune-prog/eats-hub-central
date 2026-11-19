-- Éco-contribution : on expose la date de commande qu'Uber met sur chaque ligne (« Date de la commande »,
-- ou « Date locale à laquelle la commande a été passée… » dans le format de rapport à colonnes longues).
--
-- Pourquoi : certains montants tombent à la fois sur un multiple du taux 2025 et du taux 2026. Exemple vérifié
-- sur le relevé Uber le 19/11/2026 : Tasty Crousty Chevilly-Larue, −42,25 € versés le 16/03/2026 =
-- « Éco-contribution du 15/12/2025 au 21/12/2025 : 310 commandes x 0,1363 EUR » (et aussi 231 × 0,1829).
-- La date de commande de la ligne (29/12/2025) permet alors de trancher l'année : la page s'en sert.
-- Seule la colonne order_date est ajoutée en fin de vue ; le reste est identique.

CREATE OR REPLACE VIEW public.eco_contribution_lines WITH (security_invoker = true) AS
WITH raw_lines AS (
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
        AND l2.source_duplicate_of IS NULL
        AND (l2.category = 'eco_contribution' OR public.payout_line_was_eco(l2.id)))
    AND round(a.amount, 2) IS DISTINCT FROM public.payout_raw_autres_frais_total(a.restaurant_id, a.payout_reference_id)
),
parsed AS (
  SELECT s.id, s.restaurant_id, s.restaurant_name, s.payout_reference_id, s.payout_date, s.description, s.amount, s.source_kind,
    coalesce(nullif(s.raw_columns->>'Date de la commande', ''),
             nullif(s.raw_columns->>'Date locale à laquelle la commande a été passée ou date locale de la commande d''origine passée pour laquelle un remboursement a été effectué', '')) AS order_date,
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
       END AS eco_kind,
       w.order_date
FROM waved w
LEFT JOIN typical ty ON ty.restaurant_id = w.restaurant_id;

GRANT SELECT ON public.eco_contribution_lines TO authenticated, service_role;
REVOKE ALL ON public.eco_contribution_lines FROM anon;

