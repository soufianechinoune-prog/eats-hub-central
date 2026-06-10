
## Plan : Import test + sondage backfill Dishop

### Étape 1 — Import test de la semaine en cours
- Déclencher manuellement l'edge function `dishop-sync-week` (bouton "Synchroniser la semaine" sur la carte Dishop).
- La fonction :
  1. Télécharge le ZIP `/export-weekly-data/accounting-report` de Dishop (auth déjà OK, companyId en lowercase).
  2. Parse les CSV `orders.csv`, `order_items.csv`, `customers.csv`.
  3. Insère dans `dishop_orders`, `dishop_order_items`, `dishop_customers` (dédup via `dishop_order_id`).
  4. Rattache chaque ligne au `restaurant_id` via `dishop_shop_mapping` (les shops non mappés restent en attente, rattachables plus tard sans réimport).
  5. Loggue le résultat dans `dishop_sync_runs` (nb orders, items, customers, mappés vs non mappés, erreurs).

### Étape 2 — Vérification des données importées
- Lire `dishop_sync_runs` pour voir le résumé de la run.
- Compter `dishop_orders` par shop pour la semaine.
- Comparer le CA Dishop d'un restaurant déjà mappé vs son CA Uber/Deliveroo sur la même période (sanity check).
- Afficher le résumé dans la carte Dishop : dernière sync, nb orders importés, nb shops non mappés.

### Étape 3 — Sondage de l'API pour le backfill historique
Créer une nouvelle edge function `dishop-probe-history` qui teste en parallèle plusieurs formats d'URL sur l'endpoint `accounting-report` :
- `?week=2026-W22`
- `?week=22&year=2026`
- `?date=2026-05-25` (lundi d'une semaine passée)
- `?from=2026-05-25&to=2026-05-31`
- `/weeks/22`
- `/2026/22`

Pour chaque variante : status HTTP, taille du payload, présence de données. Stocker le résultat dans une nouvelle table légère `dishop_probe_results` (ou simplement renvoyer le rapport au front).

### Étape 4 — UI de pilotage sur la carte Dishop
Ajouter 2 boutons sur `DishopIntegrationCard` :
- **"Synchroniser la semaine"** → invoke `dishop-sync-week`, toast avec résultat.
- **"Sonder l'historique"** → invoke `dishop-probe-history`, affiche un tableau des formats qui marchent.

Selon les résultats du sondage, on décidera ensuite (autre tour) :
- Si un format fonctionne → ajouter un bouton "Backfiller N semaines" (déjà supporté côté `backfill_jobs` / `backfill_runs`).
- Sinon → demander à Dishop un endpoint historique dédié.

### Détails techniques
- `dishop-sync-week` existe déjà — vérifier qu'il loggue bien les shops non mappés sans crasher.
- `dishop-probe-history` : nouvelle fonction, lecture seule (aucune écriture dans `dishop_orders`).
- Pas de migration nécessaire pour l'étape 1-2. Étape 3 : pas de migration non plus si on renvoie juste le rapport au front.
- Côté front : `useDishopSyncWeek` (mutation `supabase.functions.invoke('dishop-sync-week')`) + `useDishopProbeHistory`.

### Hors scope
- Le backfill effectif (étape 5 future, dépend des résultats du sondage).
- La complétion des shops non mappés (tu finis quand tu veux, non bloquant).
