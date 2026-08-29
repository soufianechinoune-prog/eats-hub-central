# Ré-import versements Uber juin→août — débit 5/min + vérification stricte

## Décision retenue

Upsert en place (clé `payout_reference_id` + `description` + `uber_store_id`), pas de suppression préalable. Le risque connu reste le cas où le nouveau parseur retient un `uber_store_id` différent de l'ancien : la ligne serait créée à côté au lieu d'écraser. C'est exactement ce que le contrôle des orphelines ci-dessous doit détecter.

## 1. Accélération du worker

`supabase/functions/uber-backfill-worker/index.ts` : `PARALLEL` de 2 → 5, et délai inter-job `INTER_JOB_DELAY_MS` 1500 → 1000 ms pour lisser le burst. Le requeue 429 (`next_attempt_at` + `rate_limit_retries`) est déjà en place et absorbe un éventuel throttle Uber. Environ 964 tâches en file → fin estimée ~1 h 30 à 2 h.

## 2. Photo AVANT (pré-requis au contrôle des orphelines)

`payout_adjustments` n'a pas de colonne `updated_at` : un upsert ne laisse aucune trace temporelle. Avant de monter le débit, on fige une table de snapshot `payout_adjustments_snapshot_aug29` contenant toutes les lignes juin→août 2026 des deux enseignes, avec leur clé (`payout_reference_id`, `description`, `uber_store_id`), catégorie et montant. C'est la seule façon fiable de distinguer, après le run, les lignes réécrites des lignes jamais touchées.

## 3. Vérifications de fin de run

### a. Contrôle « adjustment » de juin
Somme de la catégorie `adjustment` par enseigne sur juin 2026. Attendu : proche de 0 pour CS et TC, et en particulier les ~52 k€ Tasty redistribués en `advertising` / `eco_contribution`. Si le montant reste, on remonte le détail par description pour identifier l'étiquette Uber non routée.

### b. Lignes orphelines
Comparaison snapshot vs table courante sur la clé d'upsert : toute ligne présente dans le snapshot dont la clé n'apparaît plus dans les lignes réécrites (catégorie ou montant inchangés alors qu'une ligne jumelle existe avec un autre `uber_store_id`) est listée — resto, semaine, description, catégorie, montant. Aucune suppression automatique : la liste t'est présentée pour arbitrage.

### c. Récap AVANT / APRÈS
Tableau par enseigne × mois (juin, juillet, août) × catégorie (`advertising`, `eco_contribution`, `adjustment`, `other_fee`), montants avant et après, plus le delta. Accompagné de la liste des descriptions non reconnues loguées par le parseur pendant le run.

## Détails techniques

- Fichier modifié : `supabase/functions/uber-backfill-worker/index.ts` (2 constantes).
- Snapshot : table dédiée créée par migration, en lecture super-admin uniquement, supprimable après validation.
- Aucun changement de schéma sur `payout_adjustments`, aucun changement front.
- Suivi du run par requêtes sur `backfill_jobs` (statuts pending/running/done/failed) pendant l'exécution.
