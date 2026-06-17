## Diagnostic révisé (intégrant la remarque de l'ingénieure)

J'ai confirmé son analyse en base :

```
2026-06-15 → 704 lignes,    704 avec uber_order_id NULL
2026-06-16 → 67 905 lignes, 67 905 avec uber_order_id NULL
2026-06-17 → 83 381 lignes, 83 381 avec uber_order_id NULL
```

→ **100 % des « avis de juin » sont de la donnée corrompue** générée par le webhook `parse-report-csv` (branche `parseCustomerFeedback`). Le code (lignes 106-122) cherche `row.order_id` / `row.Order_ID` alors que le vrai header CSV Uber est `Order ID` (avec espace) ; tout retombe sur `null`, et `review_date` retombe sur `new Date().toISOString()` (date du backfill). Conséquence : `onConflict: 'uber_order_id'` ne déduplique rien → doublons massifs + dates fausses, et avril/mai n'apparaissent pas (les vraies dates ne sont jamais écrites).

Même schéma dans `parseMenuItemFeedback` (ligne 135). En revanche `parseOrderHistory` / `parseOrderErrors` de ce fichier ne sont **plus utilisés** depuis le fix d'hier (ils délèguent à `parse-order-history` / `parse-inaccurate-orders`), donc `order_history` / `order_errors` ne sont pas touchés — à vérifier rapidement par sécurité.

---

## Plan d'action

### Étape 1 — UI : supprimer le toggle Épinglés / Réseau
Dans `src/pages/RatingsComparison.tsx` :
- Retirer l'import et l'usage de `NetworkViewToggle`.
- Retirer l'état `isNetworkView` et sa persistance dans `RATINGS_STORAGE_KEY`.
- Forcer `selectedRestaurants = allActiveRestaurants` en permanence.
- Mettre à jour le sous-titre (« Analyse de N restaurants »).

### Étape 2 — Perf : filtrer côté SQL
Dans la même page, queryFn lignes 187-222 :
- Construire `const ids = selectedRestaurants.map(r => r.id)`.
- Ajouter `.in('restaurant_id', ids)` à la requête.
- Garder la pagination `.range()` par 1000.
- Volume attendu : ~17 k lignes au lieu de ~200 k pour l'année.

### Étape 3 — Intégrité : purger les avis corrompus AVANT toute chose
Migration / SQL ciblé :
```sql
DELETE FROM public.customer_reviews
 WHERE uber_order_id IS NULL
    OR review_date >= '2026-06-15';

DELETE FROM public.menu_item_reviews
 WHERE review_date >= '2026-06-15';
```
Justification : tout ce qui a `uber_order_id IS NULL` est corrompu par construction (le vrai parser populent toujours l'ID) ; on borne aussi par date pour rattraper les éventuels lignes 15-17 juin qui auraient malgré tout un ID.

### Étape 4 — Corriger `parse-report-csv` (avis)
Dans `supabase/functions/parse-report-csv/index.ts` :
- Réécrire `parseCustomerFeedback` et `parseMenuItemFeedback` pour qu'elles **délèguent à `parse-reviews-order`** (parser éprouvé qui gère déjà : headers réels avec espaces/accents, parsing date FR/EN, mapping restaurant via alias, dédup par `uber_order_id`).
- Pattern identique à ce qu'on a fait pour ORDER_HISTORY / ORDER_ERRORS hier :
  ```ts
  case 'CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT':
    return await supabase.functions.invoke('parse-reviews-order', {
      body: { csvContent, restaurantId, dryRun: false }
    });
  ```
- Pour `MENU_ITEM_FEEDBACK_REPORT` : si aucun parser éprouvé n'existe, écrire un mapping correct (`Item ID`, `Item Name`, `Rating`, `Thumbs Up`, `Thumbs Down`, `Comment`, `Date`) et utiliser la vraie date (pas `new Date()`).

### Étape 5 — Re-parser avril / mai / début juin
- Lister les `reports` `report_type IN ('CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT','MENU_ITEM_FEEDBACK_REPORT')`, `status = 'completed'`, créés entre le 1er avril et le 14 juin.
- Re-invoquer `parse-report-csv` directement si la `download_url` est encore valide ; sinon créer des `backfill_jobs` ciblés (vague=996) pour que le worker régénère puis re-parse.

### Étape 6 — Vérifications finales
```sql
-- 1. Plus de NULL, plus de pic faux sur juin
SELECT review_date::date, COUNT(*),
       COUNT(*) FILTER (WHERE uber_order_id IS NULL) AS nulls
FROM customer_reviews
WHERE review_date >= '2026-03-01'
GROUP BY 1 ORDER BY 1;

-- 2. Avril / mai remontent autour de ~100 restos
SELECT date_trunc('month', review_date) AS m,
       COUNT(DISTINCT restaurant_id) AS nb_restos,
       COUNT(*) AS nb_avis
FROM customer_reviews
WHERE review_date >= '2026-01-01'
GROUP BY 1 ORDER BY 1;

-- 3. Check sécurité : pas de contamination ailleurs
SELECT 'order_history' tbl, COUNT(*) FROM order_history WHERE uber_order_id IS NULL
UNION ALL
SELECT 'order_errors', COUNT(*) FROM order_errors WHERE uber_order_id IS NULL;
```
Si les 2 dernières lignes valent 0 → `order_history` / `order_errors` épargnés (attendu, car ils ne passent plus par `parse-report-csv` depuis hier).

---

## Ordre d'exécution non négociable
1 (UI) et 2 (perf) en parallèle, puis **3 (purge) AVANT 5 (re-parse)**, sinon doublons. 4 (fix code) avant 5 sinon on re-corrompt.

## Hors-scope
Pas de changement de schéma DB. Pas de RPC d'agrégation `get_network_ratings_summary` (à garder en réserve si la perf reste insuffisante après étape 2).
