-- Pub Uber : ne plus compter deux fois une ligne arrivée par deux rapports différents.
--
-- Constat du 17/11/2026 : le rattrapage du mardi a réimporté 857 lignes de pub déjà présentes
-- (versements du 4 au 16 novembre, 36 592,63 € TTC). Uber les a livrées avec des intitulés de colonnes
-- légèrement différents ; elles n'ont donc pas reçu le marqueur source_duplicate_of et la vue les sommait
-- deux fois (semaine du 9 novembre : +46 % sur Chicken Street, +48 % sur Tasty Crousty).
--
-- Règle : pour un même restaurant, un même versement, un même montant ET une même date de commande,
-- on ne garde que les lignes d'un seul rapport (le premier). La date de commande fait partie de la clé :
-- deux vraies campagnes de même montant sur deux jours différents restent bien deux lignes. Et deux lignes
-- identiques à l'intérieur d'un même rapport sont conservées toutes les deux.
--
-- C'est un garde-fou à la lecture. Le vrai correctif reste à faire à l'import (reconnaître le doublon
-- dès l'arrivée du rapport), sinon la table continue de grossir chaque mardi.
-- Retour arrière : rejouer la définition de la migration 20261113091500.

CREATE OR REPLACE VIEW public.ads_advertising_lines WITH (security_invoker = true) AS
SELECT d.restaurant_id, d.payout_reference_id, d.payout_date, d.amount, d.category, 'raw'::text AS source_kind
FROM (
  SELECT l.restaurant_id, l.payout_reference_id, l.payout_date, l.amount, l.category,
         dense_rank() OVER (
           PARTITION BY l.restaurant_id, l.payout_reference_id, round(l.amount, 2),
                        coalesce(l.raw_columns->>'Date de la commande', '')
           ORDER BY l.source_report_hash NULLS FIRST) AS report_rank
  FROM public.payout_adjustment_lines l
  WHERE l.category = 'advertising' AND l.source_duplicate_of IS NULL
) d
WHERE d.report_rank = 1
UNION ALL
SELECT a.restaurant_id, a.payout_reference_id, a.payout_date, a.amount, a.category, 'legacy'::text AS source_kind
FROM public.payout_adjustments a
WHERE a.category = 'advertising'
  AND NOT EXISTS (
    SELECT 1 FROM public.payout_adjustment_lines l2
    WHERE l2.restaurant_id = a.restaurant_id AND l2.payout_reference_id = a.payout_reference_id
      AND l2.source_duplicate_of IS NULL);
