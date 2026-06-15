## Vérification du test prep time

**Résultat du backfill `ebffc9b8…`** :
- 344 rapports demandés, 134 OK / 210 failed côté Uber API
- Webhook reçu et "Report parsed successfully" pour les 134 OK
- Mais **`order_history` est vide (0 lignes)** → `initial_prep_time_minutes` introuvable

## Cause racine

Dans `supabase/functions/uber-report-webhook/index.ts` (lignes 224–238), le report `ORDER_HISTORY_REPORT` est routé vers `parse-report-csv`. Or `parse-report-csv` :

1. Écrit dans **`delivery_stats`** (pas `order_history`)
2. Cherche des entêtes anglaises (`preparation_time`, `Preparation_Time`) alors que l'API Uber renvoie des CSV **français** ("temps de préparation initial", etc.)

Résultat : aucune ligne n'est insérée nulle part (delivery_stats est aussi à 0). C'est exactement le même bug qui avait été corrigé pour les reviews (`CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT` → `parse-reviews-order`).

Une fonction dédiée **`parse-order-history`** existe déjà et :
- parse les entêtes FR (`temps de préparation initial`)
- écrit dans `order_history` avec `initial_prep_time_minutes`
- accepte le payload `{ csvContent, restaurantId, dryRun }` (même signature que les parsers reviews)

Elle n'est juste pas branchée dans le webhook.

## Plan de correction

### 1. Brancher `parse-order-history` dans le webhook

Dans `supabase/functions/uber-report-webhook/index.ts`, étendre la map de routing FR-aware existante :

```ts
const reviewParserByType: Record<string, string> = {
  CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT: 'parse-reviews-order',
  MENU_ITEM_FEEDBACK_REPORT: 'parse-reviews-item',
  ORDER_HISTORY_REPORT: 'parse-order-history',   // ← ajout
};
```

(Renommer aussi la variable en `frAwareParserByType` pour la clarté, pas obligatoire.)

Le bloc existant télécharge déjà le CSV et invoque le parser avec le bon payload `{ csvContent, dryRun, restaurantId }` — rien d'autre à changer côté webhook.

### 2. Relancer un test ciblé

Re-déclencher un mini-backfill `ORDER_HISTORY_REPORT` sur **1 semaine de janvier 2026** (mêmes 172 restos), puis :

```sql
SELECT date_trunc('day', order_datetime) d,
       COUNT(*) nb,
       ROUND(AVG(initial_prep_time_minutes)::numeric, 2) avg_prep
FROM order_history
WHERE order_datetime BETWEEN '2026-01-05' AND '2026-01-12'
GROUP BY 1 ORDER BY 1;
```

→ Si avg_prep ressort entre 5 et 15 min sur 7 jours, la page `PrepTimeComparison` affichera les données.

### 3. Décision après validation

- **OK** → tu valides et on étend (jan→juin 2026, ou Q1).
- **KO** → on regarde les logs `parse-order-history` (mapping de colonnes, format date Uber).

## Hors scope

- Pas de changement de schéma (`order_history` a déjà la colonne).
- Pas de changement UI (`PrepTimeComparison` est déjà câblé sur `order_history.initial_prep_time_minutes`).
- Pas de touche à `parse-report-csv` (autres report types continuent d'y passer).
