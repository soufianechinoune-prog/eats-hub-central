# Fix méthodique — Insertion des avis API Uber en base

## 🔎 Diagnostic confirmé

L'API Uber renvoie bien les CSV (174 avis clients + 75 avis items pour Chicken Street, mai 2026), le webhook les reçoit, mais **rien ne s'insère**. Cause exacte :

Le webhook (`uber-report-webhook`) route les 2 rapports d'avis vers `parse-report-csv`, qui :
1. Split CSV de façon naïve (`line.split(',')`) → casse les champs entre guillemets (ex : tags `"item_tasty, item_fresh"` deviennent 2 colonnes).
2. Cherche des en-têtes **anglais** (`order_id`, `overall_rating`, `comment`, `review_date`) alors que l'API Uber renvoie tout en **français** (`UUID de la commande`, `Valeur de la note`, `Commentaire`, `Date de la note`, `Tags de notation`).
3. Résultat : tous les champs sont `null`, l'upsert sur `uber_order_id=null` échoue silencieusement.

À l'inverse, les fonctions `parse-reviews-order` et `parse-reviews-item` (utilisées pour les imports CSV manuels) **savent parfaitement parser ce format** : parser CSV qui respecte les guillemets, mapping FR + EN, dédup par `uber_order_id`, résolution restaurant via UUID/alias, gestion des tags en array.

## 🎯 Là où la data DOIT s'insérer (et apparaître dans l'UI)

| Table cible | Page UI alimentée |
|---|---|
| `customer_reviews` | `/analytics/reviews` → KPI Note période, Évolution, Distribution, Clients, Tags · `/compare/ratings` Comparaison Notes · Vue d'ensemble (carte Note moyenne) |
| `menu_item_reviews` | `/analytics/reviews` onglet Plats · ProductsHeatmap · TopFlop |

## 🛠 Plan d'action

### Phase A — Patch du webhook (1 seul fichier modifié)
**Fichier** : `supabase/functions/uber-report-webhook/index.ts`

Dans le bloc `else if (parseableReports.includes(...))` (lignes 176-204), ajouter un routage spécifique avant le fallback `parse-report-csv` :
- `CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT` → télécharger le CSV depuis `section.download_url`, puis invoquer `parse-reviews-order` avec `{ csvContent, restaurantId, dryRun: false }`.
- `MENU_ITEM_FEEDBACK_REPORT` → idem vers `parse-reviews-item`.
- Tous les autres (`ORDER_HISTORY_REPORT`, `ORDER_ERRORS_*`, `DOWNTIME_REPORT`) → on **garde** le routage existant vers `parse-report-csv` (hors scope).

Logs ajoutés à chaque étape (download OK + taille CSV, stats du parser) pour debug futur.

### Phase B — Rejouer mai 2026 Chicken Street Argenteuil
Les 2 rapports sont déjà en base (`reports.id` `84c490b4...` et `b04a4744...`) avec leurs `sections.download_url` Uber valides jusqu'au 16 juin ~02h UTC.

Une fois la phase A déployée :
1. Récupérer les 2 `download_url` depuis `reports.sections`.
2. Invoquer **directement** `parse-reviews-order` et `parse-reviews-item` (via `supabase--curl_edge_functions`) avec le `csvContent` téléchargé + `restaurantId=d69579a6...`.
3. Vérifier en SQL :
   - `SELECT COUNT(*), AVG(overall_rating) FROM customer_reviews WHERE restaurant_id='d69579a6…' AND review_date BETWEEN '2026-05-01' AND '2026-05-31';`
   - Cible attendue : **174 lignes**, note moyenne ~**4,37** (cohérent avec ce qu'on a déjà extrait du CSV).
4. Aller sur `/analytics/reviews` + `/compare/ratings` filtrés sur Chicken Street Argenteuil + période mai 2026 → confirmer visuellement les KPI, tags, commentaires.

### Phase C — Validation finale par toi
Quand A+B sont OK, on s'arrête et on attend ton feu vert pour les étapes suivantes :
- 📌 Backfill de l'historique complet Chicken Street (et autres restaurants) pour rattraper tous les mois manqués
- 📌 Ajouter `CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT` + `MENU_ITEM_FEEDBACK_REPORT` au **scheduler hebdo** pour qu'ils tournent automatiquement chaque semaine comme `PAYMENT_DETAILS_REPORT`
- 📌 Fix éventuel du parser `parse-report-csv` pour DOWNTIME / ORDER_HISTORY (même bug FR/EN, mais hors urgence)

## 📦 Périmètre de cette livraison

**Modifié** : `supabase/functions/uber-report-webhook/index.ts` uniquement.

**Non touché** : `parse-reviews-order`, `parse-reviews-item`, `parse-report-csv`, scheduler, schéma DB, UI.

**Risque** : nul côté UI (aucune query ni composant changé). Côté webhook, le seul nouveau comportement concerne 2 types de rapports qui ne s'insèrent **jamais** aujourd'hui — donc pas de régression possible.
