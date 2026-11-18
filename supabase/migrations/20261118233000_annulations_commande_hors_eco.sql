-- Annulations de paiement de commande : ce n'est pas de l'éco-contribution.
--
-- Constat (Tasty Crousty Cergy et Les Pavillons-sous-Bois, relevés Uber vérifiés le 18/11/2026) :
-- « Annulation du paiement pour la commande 407C6 du 2026-03-20 suite au signalement de la fermeture du
-- restaurant par plusieurs coursiers » −8,96 € arrive dans le CSV comme « Autres frais ». 8,96 € tombe
-- par hasard sur 49 × 0,1829 : l'import l'a classée éco-contribution, et Cergy affichait « À déclarer ».
--
-- Ce qui les distingue : une vraie éco-contribution porte son montant dans la colonne « Autres paiements »
-- (« Toute les sommes uniques… » dans le format de rapport à colonnes longues). Ces annulations ont 0
-- dans cette colonne et seulement le « Montant total ». Vérifié sur tout le réseau le 18/11/2026 :
-- aucun prélèvement ni remboursement reconnu n'a 0 dans « Autres paiements ».
--
-- 1) reclassify_small_payout_lines gagne une règle « sans_autres_paiements » (éco-contribution → other_fee)
--    et lit les deux formats de colonnes (court et long) pour Autres paiements et Titre-restaurant.
-- 2) Vue : l'ancienne table (montants regroupés par versement) ne s'affiche plus quand les lignes détaillées
--    « Autres frais » du versement donnent exactement le même total (Pavillons : −7,76 € = −9,73 € d'annulation
--    + 1,97 € de titre-restaurant).
-- Rien n'est supprimé ; chaque changement est tracé dans payout_line_reclassifications.

CREATE OR REPLACE FUNCTION public.payout_raw_num(p_raw jsonb, p_short text, p_long text)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $function$
  SELECT CASE WHEN v ~ '^-?\d+(\.\d+)?$' THEN v::numeric END
  FROM (SELECT coalesce(nullif(p_raw->>p_short, ''), nullif(p_raw->>p_long, '')) AS v) s;
$function$;

CREATE OR REPLACE FUNCTION public.reclassify_small_payout_lines(p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS TABLE(rule text, lines integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_meal integer := 0; v_noap integer := 0; v_mirror integer := 0;
  c_ap_s constant text := 'Autres paiements (TVA incluse)';
  c_ap_l constant text := 'Toute les sommes uniques comme les paiements des annonces, les crédits des annonces, etc. incluent la TVA, le cas échéant';
  c_tr_s constant text := 'Titre-restaurant';
  c_tr_l constant text := 'Versement par l''entité tierce de titres-restaurant, p. ex., Edenred, Swile, etc.';
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 1) Retours de titres-restaurant : montant dans la colonne titre-restaurant, rien dans Autres paiements.
  WITH c AS (
    SELECT l.id, l.category
    FROM payout_adjustment_lines l
    WHERE (p_restaurant_ids IS NULL OR l.restaurant_id = ANY(p_restaurant_ids))
      AND l.category IN ('other_fee', 'eco_contribution')
      AND lower(coalesce(l.description, '')) LIKE 'autres frais%'
      AND coalesce(payout_raw_num(l.raw_columns, c_tr_s, c_tr_l), 0) <> 0
      AND coalesce(payout_raw_num(l.raw_columns, c_ap_s, c_ap_l), 0) = 0
  ), u AS (
    UPDATE payout_adjustment_lines l SET category = 'meal_voucher_return'
    FROM c WHERE l.id = c.id
    RETURNING l.id, c.category AS old_category
  )
  INSERT INTO payout_line_reclassifications (line_id, old_category, new_category, rule)
  SELECT u.id, u.old_category, 'meal_voucher_return', 'titre_restaurant' FROM u;
  GET DIAGNOSTICS v_meal = ROW_COUNT;

  -- 2) Éco-contribution sans montant dans Autres paiements : annulation de paiement de commande ou autre
  --    reprise, pas de l'éco-contribution.
  WITH c AS (
    SELECT l.id
    FROM payout_adjustment_lines l
    WHERE (p_restaurant_ids IS NULL OR l.restaurant_id = ANY(p_restaurant_ids))
      AND l.category = 'eco_contribution'
      AND lower(coalesce(l.description, '')) LIKE 'autres frais%'
      AND coalesce(payout_raw_num(l.raw_columns, c_ap_s, c_ap_l), 0) = 0
      AND coalesce(payout_raw_num(l.raw_columns, c_tr_s, c_tr_l), 0) = 0
  ), u AS (
    UPDATE payout_adjustment_lines l SET category = 'other_fee'
    FROM c WHERE l.id = c.id
    RETURNING l.id
  )
  INSERT INTO payout_line_reclassifications (line_id, old_category, new_category, rule)
  SELECT u.id, 'eco_contribution', 'other_fee', 'sans_autres_paiements' FROM u;
  GET DIAGNOSTICS v_noap = ROW_COUNT;

  -- 3) Petites éco-contributions reconnues par leur miroir (avec un montant dans Autres paiements).
  WITH cand AS (
    SELECT l.id, l.restaurant_id, l.payout_reference_id, l.payout_date, l.category,
           round(l.amount, 2) AS amt, coalesce(l.order_date_key, '') AS dt,
           row_number() OVER (
             PARTITION BY l.restaurant_id, l.payout_reference_id, round(l.amount, 2), coalesce(l.order_date_key, ''), l.source_report_hash
             ORDER BY l.source_record_index, l.id) AS occ
    FROM payout_adjustment_lines l
    WHERE (p_restaurant_ids IS NULL OR l.restaurant_id = ANY(p_restaurant_ids))
      AND l.category IN ('other_fee', 'eco_contribution')
      AND lower(coalesce(l.description, '')) LIKE 'autres frais%'
      AND l.amount <> 0 AND abs(l.amount) < 5
      AND coalesce(payout_raw_num(l.raw_columns, c_tr_s, c_tr_l), 0) = 0
      AND coalesce(payout_raw_num(l.raw_columns, c_ap_s, c_ap_l), 0) <> 0
      AND LEAST(
            abs(abs(l.amount) - round(abs(l.amount) / 0.1829) * 0.1829),
            abs(abs(l.amount) - round(abs(l.amount) / 0.1381) * 0.1381),
            abs(abs(l.amount) - round(abs(l.amount) / 0.1363) * 0.1363)) <= 0.0051
  ),
  slots AS (
    SELECT DISTINCT restaurant_id, payout_reference_id, payout_date, amt, dt, occ FROM cand
  ),
  ranked AS (
    SELECT s.*, row_number() OVER (
             PARTITION BY s.restaurant_id, abs(s.amt), sign(s.amt)
             ORDER BY s.payout_date, s.payout_reference_id, s.dt, s.occ) AS rn
    FROM slots s
  ),
  pairs AS (
    SELECT n.restaurant_id, n.payout_reference_id AS n_ref, n.amt AS n_amt, n.dt AS n_dt, n.occ AS n_occ,
           p.payout_reference_id AS p_ref, p.amt AS p_amt, p.dt AS p_dt, p.occ AS p_occ
    FROM ranked n
    JOIN ranked p ON p.restaurant_id = n.restaurant_id AND p.amt = -n.amt AND p.rn = n.rn
                 AND n.amt < 0 AND p.payout_date >= n.payout_date
  ),
  targets AS (
    SELECT c.id, c.category FROM cand c
    JOIN pairs x ON x.restaurant_id = c.restaurant_id
      AND ((c.payout_reference_id = x.n_ref AND c.amt = x.n_amt AND c.dt = x.n_dt AND c.occ = x.n_occ)
        OR (c.payout_reference_id = x.p_ref AND c.amt = x.p_amt AND c.dt = x.p_dt AND c.occ = x.p_occ))
    WHERE c.category = 'other_fee'
  ), u AS (
    UPDATE payout_adjustment_lines l SET category = 'eco_contribution'
    FROM (SELECT DISTINCT id, category FROM targets) t WHERE l.id = t.id
    RETURNING l.id, t.category AS old_category
  )
  INSERT INTO payout_line_reclassifications (line_id, old_category, new_category, rule)
  SELECT u.id, u.old_category, 'eco_contribution', 'miroir' FROM u;
  GET DIAGNOSTICS v_mirror = ROW_COUNT;

  RETURN QUERY VALUES ('titre_restaurant'::text, v_meal), ('sans_autres_paiements'::text, v_noap), ('miroir'::text, v_mirror);
END $function$;

REVOKE ALL ON FUNCTION public.reclassify_small_payout_lines(uuid[]) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.reclassify_small_payout_lines(uuid[]) TO service_role;

-- Total des lignes détaillées « Autres frais » d'un versement (copies entre rapports exclues).
CREATE OR REPLACE FUNCTION public.payout_raw_autres_frais_total(p_restaurant_id uuid, p_payout_ref text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT round(sum(l.amount), 2) FROM payout_adjustment_lines l
  WHERE l.restaurant_id = p_restaurant_id AND l.payout_reference_id = p_payout_ref
    AND l.source_duplicate_of IS NULL AND lower(coalesce(l.description, '')) LIKE 'autres frais%';
$function$;
REVOKE ALL ON FUNCTION public.payout_raw_autres_frais_total(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.payout_raw_autres_frais_total(uuid, text) TO authenticated, service_role;

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
       END AS eco_kind
FROM waved w
LEFT JOIN typical ty ON ty.restaurant_id = w.restaurant_id;

GRANT SELECT ON public.eco_contribution_lines TO authenticated, service_role;
REVOKE ALL ON public.eco_contribution_lines FROM anon;

SELECT * FROM public.reclassify_small_payout_lines(NULL);
