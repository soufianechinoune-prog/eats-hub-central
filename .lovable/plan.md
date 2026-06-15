## Objectif
Combler les mois sans avis (jan, fév, mar, avr 2026) sur la `Vue d'ensemble`, puisque la table `customer_reviews` ne contient actuellement que mai/juin 2026.

## Bonne nouvelle : aucun code à écrire
La fonction edge `uber-backfill-reports` existe déjà et accepte n'importe quel `reportType` Uber. Le webhook `uber-report-webhook` route automatiquement :
- `CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT` → `parse-reviews-order` → table `customer_reviews`
- `MENU_ITEM_FEEDBACK_REPORT` → `parse-reviews-item` → table `menu_item_reviews`

## Action à exécuter
Lancer **2 backfills** sur l'ensemble des 171 restaurants Uber, couvrant **janvier → avril 2026** (mai/juin déjà OK) :

1. **Backfill avis clients (notes + commentaires)**
   ```
   POST /functions/v1/uber-backfill-reports
   {
     "reportType": "CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT",
     "months": [
       {"year":2026,"month":1},
       {"year":2026,"month":2},
       {"year":2026,"month":3},
       {"year":2026,"month":4}
     ],
     "vague": "backfill-reviews-q1-2026"
   }
   ```

2. **Backfill avis produits (👍/👎 par item)**
   ```
   POST /functions/v1/uber-backfill-reports
   {
     "reportType": "MENU_ITEM_FEEDBACK_REPORT",
     "months": [...même 4 mois...],
     "vague": "backfill-item-reviews-q1-2026"
   }
   ```

## Volume & délai
- 171 restos × 4 fenêtres = **684 rapports** par type → **~1 368 rapports** au total
- Chaque appel Uber : ~0.5s + throttling → la fonction tournera quelques minutes pour planifier
- Les rapports sont ensuite **générés en asynchrone par Uber** (typiquement 5-30 min chacun) puis ingérés au fur et à mesure via le webhook → la donnée apparaîtra progressivement dans `customer_reviews` / `menu_item_reviews` sur les prochaines heures.

## Vérification après coup
Une heure après le lancement, requête :
```sql
SELECT date_trunc('month', review_date) AS m, COUNT(*)
FROM customer_reviews
WHERE review_date BETWEEN '2026-01-01' AND '2026-04-30'
GROUP BY 1 ORDER BY 1;
```
→ on doit voir 4 lignes (jan/fév/mar/avr) avec du volume. La carte "Note moyenne" sur Vue d'ensemble passera de `--` à une valeur dès le premier rapport reçu pour la période sélectionnée.

## Risques / limites Uber
- L'API Uber **rejette** les rapports `> 30 jours` → déjà géré par `splitInto30DayWindows`.
- Si certains restaurants n'avaient pas encore d'`uber_store_id` configuré en janvier, leur backfill renverra une erreur "Restaurant has no uber_store_id" : capturée dans `backfill_runs.results`, sans bloquer les autres.
- Si Uber ne conserve pas l'historique avis aussi loin (peu probable, leur rétention est ≥ 12 mois), les rapports reviendront vides — comportement non destructif.

## Prochaine étape
Une fois ta validation reçue, je déclenche les 2 appels dans la foulée et je te renvoie les `runId` pour suivi dans `backfill_runs`.
