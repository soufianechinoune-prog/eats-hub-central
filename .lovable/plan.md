# Backfill avis produits Uber — juin 2026

## Constat

Requêtes DB :

| Mois 2026 | customer_reviews | menu_item_reviews |
|---|---|---|
| Janvier | 779 | 212 |
| Février | 4 774 | 85 |
| Mars | 802 | 136 |
| Avril | 935 | 92 |
| Mai | 174 | **74** |
| Juin | 704 | **0** ← manquant |

Les avis clients de juin sont bien là (704), mais les avis **produits** (table `menu_item_reviews`, qui alimente la cartographie produits / tags par item) n'ont jamais été synchronisés pour juin 2026.

Cause : le dernier backfill couvrait janvier → avril 2026. Le webhook temps réel n'envoie pas ce type de rapport — il faut le générer explicitement via `MENU_ITEM_FEEDBACK_REPORT`.

## Action

Lancer un seul backfill ciblé, sans aucune modification de code :

- Fonction : `uber-backfill-reports` (déjà en place, mode fire-and-forget)
- `reportType` : `MENU_ITEM_FEEDBACK_REPORT`
- Période : **2026-06-01 → 2026-06-30**
- Périmètre : 172 restaurants Uber actifs (même liste que les runs Q1)
- Volume estimé : 172 rapports (1 fenêtre de 30 j × 172 stores)
- Durée : ~2 min de planification côté edge, puis ingestion progressive via webhook sur 10–30 min

## Vérification après lancement

```sql
SELECT date_trunc('day', review_date) AS d, COUNT(*)
FROM menu_item_reviews
WHERE review_date BETWEEN '2026-06-01' AND '2026-06-30'
GROUP BY 1 ORDER BY 1;
```

Attendu : volume quotidien non nul réparti sur juin, et la page **Avis › Produits** affiche les tags/notes par item pour juin.

## Détails techniques

- Aucune modification de code, ni de schéma, ni de RLS.
- Un nouveau `backfill_runs` sera créé ; les erreurs par restaurant (store sans `uber_store_id` sur juin, 4xx Uber) seront capturées dans `results` comme pour les runs précédents.
- Pas de doublon : `parse-reviews-item` upsert sur l'ID de review.
- Les avis clients de juin n'ont pas besoin d'action (704 lignes déjà présentes).
