# Débloquer la file de backfill, puis router les −52 k€ Tasty de juin

## Constat vérifié

- Le worker tourne toujours (dernier job passé en `done` à 07:43 UTC ce matin), mais il est bridé : 2 jobs par tick avec 5 s d'attente entre chaque, soit ~2 jobs/minute. Avec 1 373 jobs en attente, la file met environ 11 h à se vider.
- Sur ces 1 373 jobs, environ 197 sont des `ORDER_ERRORS_TRANSACTION_REPORT`. Ce type de rapport a déjà échoué 11 519 fois avec le même message Uber : « endDate must be 4 days before current date ». Ils échoueront encore et occupent la file pour rien.
- Des jobs `pending` portent une date de création aberrante (2021), résidus d'anciens runs jamais purgés.
- Les −52 078 € Tasty de juin sont concentrés sur un seul libellé Uber : **« Ajustement des frais de service »** (55 lignes), rangé en catégorie générique `adjustment`. Un second libellé, « Ajustement lié à l'arrondissement de la TVA », tombe aussi en `adjustment` alors que la catégorie `tax_rounding` existe déjà et est utilisée ailleurs.

## Étape 1 — Débloquer la file

**a. Remonter le débit du worker.** Dans `supabase/functions/uber-backfill-worker/index.ts` : `PARALLEL` de 2 → 5 et `INTER_JOB_DELAY_MS` de 5000 → 1200 ms. Soit ~5 jobs toutes les 6 s au lieu de 2 toutes les 10 s. Le requeue 429 (`next_attempt_at` + `rate_limit_retries`) déjà en place absorbe un éventuel throttle Uber, donc la montée reste réversible sans risque de perte de jobs. Fin de file estimée : ~1 h 30.

**b. Corriger la fenêtre des ORDER_ERRORS.** Ces rapports ne sont pas disponibles chez Uber sur les 4 derniers jours. Le worker rabotera la `month_end` de tout job dont la fin dépasse J−4, et marquera `skipped` (et non `failed`) le job dont la fenêtre devient vide. Cela stoppe la génération d'échecs en boucle.

**c. Purger la file morte.** Passer en `abandoned` les jobs `pending` créés il y a plus de 30 jours (résidus 2021 et anciens runs), pour que le compteur de file reflète le travail réel restant.

**d. Contrôle de fin.** Après ~2 h, relevé du nombre de `pending` restants, des nouveaux `failed` par type de rapport, et confirmation que les 195 `PAYMENT_DETAILS_REPORT` en attente sont bien passés.

## Étape 2 — Router les ajustements de juin

**a. Corriger le parseur.** Dans `parse-payment-report`, la fonction `routeAdjustment` reçoit deux nouvelles règles sur les libellés 2026 :
- « Ajustement des frais de service » → catégorie `service_fee` (nouvelle étiquette dédiée, plutôt que de la noyer dans `other_fee` : c'est un poste contractuel à suivre séparément, et la page Offres & Frais l'attend).
- « Ajustement lié à l'arrondissement de la TVA » → catégorie `tax_rounding`, cohérente avec le reste de la base.

**b. Rejouer juin sur Tasty Crousty.** Ré-enfilement des jobs `PAYMENT_DETAILS_REPORT` de juin 2026 pour les 59 restos Tasty. L'upsert en place (clé `payout_reference_id` + `description` + `uber_store_id`) réécrit les lignes existantes : pas de doublon, pas de suppression préalable.

**c. Vérification.** Après rejeu : somme `adjustment` de juin par enseigne (attendu proche de 0), apparition des −52 070 € en `service_fee`, et récap avant/après par mois × catégorie contre le snapshot `payout_adjustments_snapshot_aug29`.

## Points annexes relevés (hors périmètre, à arbitrer)

- La table `payouts` est **entièrement vide** (0 ligne). Les montants agrégés de versement — ventes, net payout, éco-contribution consolidée — ne sont plus alimentés du tout ; seul `payout_adjustments` l'est. La page Éco-contribution bascule donc en permanence sur son fallback ligne à ligne. À traiter séparément, ce n'est pas un effet du ré-import.
- 663 jobs `user_not_allowed` restent bloqués sur les stores non provisionnés par Uber — c'est l'objet du mail à Sanjay, rien à corriger côté code.

## Détails techniques

- Fichiers modifiés : `supabase/functions/uber-backfill-worker/index.ts` (2 constantes + rabotage de fenêtre), `supabase/functions/parse-payment-report/index.ts` (2 règles de routage).
- Une opération de données pour la purge des `pending` périmés et une pour le ré-enfilement de juin Tasty.
- Aucun changement de schéma, aucun changement front.
