-- Petites lignes « Autres frais » : on les range dans leur vraie catégorie, sans rien supprimer.
--
-- Constat (Tasty Crousty, vérifié sur les relevés Uber d'Ivry, Melun et Aulnay le 18/11/2026) :
-- l'export CSV appelle tout « Autres frais ». À l'import, une ligne « Autres frais » de moins de 5 €
-- partait en other_fee, et une ligne plus grosse qui tombait sur un multiple du taux partait en
-- eco_contribution. Deux erreurs en découlaient :
--   1. une vraie petite éco-contribution était perdue. Ivry : « Éco-contribution du 16/03 au 22/03 :
--      24 commandes x 0,1829 » −4,39 €, remboursée +4,39 € le 25/05 ; la page affichait −4,39 € restant.
--      Idem Melun ±0,18 € (1 commande) ;
--   2. des retours de titres-restaurant (« UberEATS Meal vouchers Marketplace – Return restaurant
--      earnings ») étaient classés éco-contribution ou autres frais. Dans le CSV, leur montant est dans
--      la colonne « Titre-restaurant » et la colonne « Autres paiements » vaut 0.
--
-- Règles :
--   - titre-restaurant : « Autres frais » avec Titre-restaurant ≠ 0 et Autres paiements = 0
--     → meal_voucher_return (quel que soit le montant) ;
--   - miroir : petite ligne « Autres frais » (< 5 €, multiple du taux, pas un titre-restaurant) dont on
--     retrouve exactement l'opposé pour le même restaurant, le prélèvement avant le remboursement
--     → eco_contribution, les deux lignes. Un multiple du taux seul ne suffit pas : avec trois taux,
--     environ un petit montant sur quatre en est un par hasard (vérifié : arrondis de TVA, titres-restaurant).
--   - tout le reste ne bouge pas.
-- Chaque changement est tracé dans payout_line_reclassifications (catégorie d'avant, d'après, règle).
-- Le reclassement tourne aussi à chaque import, avant le marquage des doublons entre rapports,
-- pour que deux copies d'une même ligne gardent la même catégorie.

CREATE TABLE IF NOT EXISTS public.payout_line_reclassifications (
  id bigserial PRIMARY KEY,
  line_id uuid NOT NULL REFERENCES public.payout_adjustment_lines(id) ON DELETE CASCADE,
  old_category text NOT NULL,
  new_category text NOT NULL,
  rule text NOT NULL,
  reclassified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payout_line_reclassifications_line ON public.payout_line_reclassifications (line_id);
ALTER TABLE public.payout_line_reclassifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payout_line_reclassifications FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.reclassify_small_payout_lines(p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS TABLE(rule text, lines integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_meal integer := 0; v_mirror integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 1) Retours de titres-restaurant.
  WITH c AS (
    SELECT l.id, l.category
    FROM payout_adjustment_lines l
    WHERE (p_restaurant_ids IS NULL OR l.restaurant_id = ANY(p_restaurant_ids))
      AND l.category IN ('other_fee', 'eco_contribution')
      AND lower(coalesce(l.description, '')) LIKE 'autres frais%'
      AND CASE WHEN l.raw_columns->>'Titre-restaurant' ~ '^-?\d+(\.\d+)?$' THEN (l.raw_columns->>'Titre-restaurant')::numeric ELSE 0 END <> 0
      AND CASE WHEN l.raw_columns->>'Autres paiements (TVA incluse)' ~ '^-?\d+(\.\d+)?$' THEN (l.raw_columns->>'Autres paiements (TVA incluse)')::numeric ELSE 0 END = 0
  ), u AS (
    UPDATE payout_adjustment_lines l SET category = 'meal_voucher_return'
    FROM c WHERE l.id = c.id
    RETURNING l.id, c.category AS old_category
  )
  INSERT INTO payout_line_reclassifications (line_id, old_category, new_category, rule)
  SELECT u.id, u.old_category, 'meal_voucher_return', 'titre_restaurant' FROM u;
  GET DIAGNOSTICS v_meal = ROW_COUNT;

  -- 2) Petites éco-contributions reconnues par leur miroir.
  --    Une « place » = restaurant, versement, montant, date de commande et rang dans le rapport :
  --    les copies d'une même ligne venues de rapports différents partagent la même place.
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
      AND CASE WHEN l.raw_columns->>'Titre-restaurant' ~ '^-?\d+(\.\d+)?$' THEN (l.raw_columns->>'Titre-restaurant')::numeric ELSE 0 END = 0
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

  RETURN QUERY VALUES ('titre_restaurant'::text, v_meal), ('miroir'::text, v_mirror);
END $function$;

REVOKE ALL ON FUNCTION public.reclassify_small_payout_lines(uuid[]) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.reclassify_small_payout_lines(uuid[]) TO service_role;

-- 3) À chaque import : reclasser avant de marquer les doublons entre rapports.
CREATE OR REPLACE FUNCTION public.stage_payout_adjustment_lines(p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer; g record; v_rest uuid[]; v_refs text[];
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid batch'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(p_rows) AS x(restaurant_id uuid,uber_store_id text,payout_reference_id text,source_line_key text,source_report_hash text,amount numeric,category text) WHERE x.restaurant_id IS NULL OR x.payout_reference_id IS NULL OR x.category IS NULL OR x.amount IS NULL OR x.source_line_key IS NULL OR length(x.source_line_key)<>64 OR x.source_report_hash IS NULL OR NOT EXISTS(SELECT 1 FROM restaurants r WHERE r.id=x.restaurant_id AND r.uber_store_id=x.uber_store_id)) THEN RAISE EXCEPTION 'invalid or inconsistent restaurant source'; END IF;
 FOR g IN SELECT DISTINCT x.restaurant_id,x.payout_reference_id FROM jsonb_to_recordset(p_rows) AS x(restaurant_id uuid,payout_reference_id text) ORDER BY 1,2 LOOP
 PERFORM pg_advisory_xact_lock(hashtextextended(g.restaurant_id::text||':'||g.payout_reference_id,0));
 IF EXISTS(SELECT 1 FROM payout_source_transitions t WHERE t.restaurant_id=g.restaurant_id AND t.payout_reference_id=g.payout_reference_id) AND EXISTS(SELECT 1 FROM jsonb_to_recordset(p_rows) AS x(restaurant_id uuid,payout_reference_id text,source_line_key text) WHERE x.restaurant_id=g.restaurant_id AND x.payout_reference_id=g.payout_reference_id AND NOT EXISTS(SELECT 1 FROM payout_adjustment_lines l WHERE l.source_line_key=x.source_line_key)) THEN RAISE EXCEPTION 'switched payout requires renewed reconciliation'; END IF;
 END LOOP;
 INSERT INTO payout_adjustment_lines(restaurant_id,uber_store_id,restaurant_name,payout_reference_id,payout_date,description,category,amount,raw_columns,source_line_key,source_report_hash,source_record_index,order_date_key)
 SELECT x.restaurant_id,x.uber_store_id,x.restaurant_name,x.payout_reference_id,x.payout_date,x.description,x.category,x.amount,x.raw_columns,x.source_line_key,x.source_report_hash,x.source_record_index,
   coalesce(nullif(x.order_date_key,''), nullif(x.raw_columns->>'Date de la commande',''))
 FROM jsonb_to_recordset(p_rows) AS x(restaurant_id uuid,uber_store_id text,restaurant_name text,payout_reference_id text,payout_date date,description text,category text,amount numeric,raw_columns jsonb,source_line_key text,source_report_hash text,source_record_index integer,order_date_key text)
 ON CONFLICT(source_line_key) DO NOTHING;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 SELECT array_agg(DISTINCT x.restaurant_id), array_agg(DISTINCT x.payout_reference_id) INTO v_rest, v_refs FROM jsonb_to_recordset(p_rows) AS x(restaurant_id uuid,payout_reference_id text);
 PERFORM public.reclassify_small_payout_lines(v_rest);
 PERFORM public.mark_cross_report_payout_duplicates(v_rest, v_refs);
 RETURN v_count;
END $function$;

-- 4) Vue éco : un versement qui avait une ligne éco-contribution, devenue titre-restaurant, reste
--    « couvert ligne à ligne » : l'ancienne table ne doit pas réapparaître pour lui. Les autres
--    versements gardent exactement la même source qu'avant.
-- La trace des reclassements n'est pas lisible par les utilisateurs : la vue la consulte par cette fonction.
CREATE OR REPLACE FUNCTION public.payout_line_was_eco(p_line_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT EXISTS (SELECT 1 FROM payout_line_reclassifications x
                 WHERE x.line_id = p_line_id AND x.old_category = 'eco_contribution');
$function$;
REVOKE ALL ON FUNCTION public.payout_line_was_eco(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.payout_line_was_eco(uuid) TO authenticated, service_role;

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

-- 5) Reclassement des lignes déjà importées.
SELECT * FROM public.reclassify_small_payout_lines(NULL);
