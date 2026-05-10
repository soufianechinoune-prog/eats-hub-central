## Approche en 2 phases

Phase 1 isole le risque sur **une seule table (`orders`)** et **une seule vue (`RestaurantComparisonTable`)**. Si validée, on étend en Phase 2.

---

## PHASE 1 — Périmètre minimal (à valider d'abord)

### A. Migration SQL (à relire avant exécution)

```sql
-- 1. Ajout colonne data_source sur orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS data_source TEXT
  CHECK (data_source IN ('uber_api', 'csv_import', 'manual'));

-- 2. Index pour les filtres/agrégats par source
CREATE INDEX IF NOT EXISTS idx_orders_data_source
  ON public.orders (restaurant_id, data_source);

-- 3. Backfill rétroactif basé sur la date de fin du backfill API par resto.
--    Logique :
--      - Si une ligne `orders` a un `created_at` >= date du 1er job backfill
--        terminé pour ce restaurant ET que `raw_payload` contient un marqueur
--        webhook (ex: champ 'workflow_id' ou 'report_id'), → 'uber_api'
--      - Sinon → 'csv_import' (toutes les anciennes lignes importées via CSV)

-- 3a. Marquer comme 'uber_api' tout ce qui a été inséré par le webhook
UPDATE public.orders
SET data_source = 'uber_api'
WHERE data_source IS NULL
  AND (
    raw_payload ? 'workflow_id'
    OR raw_payload ? 'report_id'
    OR raw_payload->>'source' = 'uber_api'
  );

-- 3b. Tout le reste = CSV (par défaut historique)
UPDATE public.orders
SET data_source = 'csv_import'
WHERE data_source IS NULL;

-- 4. Default + NOT NULL pour les futures insertions CSV (les inserts API
--    devront explicitement passer 'uber_api')
ALTER TABLE public.orders
  ALTER COLUMN data_source SET DEFAULT 'csv_import',
  ALTER COLUMN data_source SET NOT NULL;
```

> Note : on ne touche pas aux RLS (la colonne hérite des policies existantes). Aucun trigger ajouté.

### B. Edge function `uber-report-webhook`

Patch minimal : à l'INSERT/UPSERT d'une commande venue du webhook Uber, forcer `data_source: 'uber_api'`. Aucune autre logique modifiée.

### C. Composant `<DataSourceBadge>`

Nouveau fichier `src/components/analytics/DataSourceBadge.tsx` :

| Source       | Token couleur (HSL via index.css) | Icône           | Label    |
|--------------|------------------------------------|-----------------|----------|
| `uber_api`   | `bg-primary/10 text-primary`       | Cloud           | "API"    |
| `csv_import` | `bg-amber-500/10 text-amber-700`   | FileSpreadsheet | "CSV"    |
| `manual`     | `bg-muted text-muted-foreground`   | Pencil          | "Manuel" |
| `mixed`      | `bg-purple-500/10 text-purple-700` | Layers          | "Mixte"  |

Variant `size="xs"` pour cohabiter avec les badges plateforme existants. Tooltip au hover indiquant le %/répartition pour `mixed`.

### D. Toggle global

Ajout d'un toggle `Afficher la provenance des données` dans `AnalyticsContext` (état booléen + persistance `localStorage`). Affiché dans le header du `RestaurantComparisonTable` à côté du toggle "Afficher N-1". **Par défaut ON** pendant la phase de vérification.

### E. Intégration dans `RestaurantComparisonTable`

- Nouvelle requête côté hook (`useNetworkStats` ou requête dédiée légère) :
  ```sql
  SELECT restaurant_id,
         data_source,
         COUNT(*) AS n,
         SUM(gross_amount) AS revenue
  FROM orders
  WHERE restaurant_id = ANY($1)
    AND order_datetime BETWEEN $2 AND $3
  GROUP BY restaurant_id, data_source;
  ```
  → renvoie pour chaque resto la part API vs CSV sur la période.
- Affichage : un mini-badge à droite du nom du resto. Si 100% d'une source → badge unique. Sinon → badge `mixed` avec tooltip "62% API · 38% CSV".
- Sur la ligne **TOTAL RÉSEAU**, badge agrégé identique.
- Sur les sous-lignes Uber/Deliveroo (expansion), pas de badge en Phase 1 (Deliveroo n'a pas la colonne).

### F. Hors scope Phase 1

- Pas de modification des RPC `get_overview_*`, `get_yearly_payouts_detail`, `get_finances_drilldown`, etc.
- Pas de logique "API prioritaire" (dédoublonnage) — on observe d'abord les écarts avant de décider.
- Aucune autre table touchée.

---

## PHASE 2 — Extension (uniquement si Phase 1 validée)

À ne lancer qu'après accord explicite, dans un plan séparé. Périmètre prévu :

1. Ajouter `data_source` aux tables : `daily_sales_uber`, `monthly_revenue`, `daily_order_accuracy`, `monthly_order_accuracy`, `order_errors`, `monthly_fees`, `customer_reviews`, `menu_item_reviews`, `daily_conversion`, `monthly_conversion`.
2. Backfill rétroactif équivalent par table.
3. Mise à jour des RPC pour exposer `data_source` dans les résultats agrégés.
4. Logique de dédoublonnage **API prioritaire** (vue SQL ou CTE dans les RPC).
5. Badges dans `Overview` (KPICards + PlatformRevenueSplit) et `Finances` (drilldown).
6. Badges sur Items / Reviews / Operations.

---

## Validation Phase 1

Critères pour décider du go/no-go Phase 2 :
- Le badge affiche correctement la répartition sur 3-5 restos témoins.
- Le UPDATE rétroactif a bien classifié toutes les lignes (`SELECT data_source, COUNT(*) FROM orders GROUP BY 1` → 0 NULL).
- Les nouvelles commandes Uber arrivent bien taguées `uber_api`.
- Aucune régression visuelle ou de perf sur `RestaurantComparisonTable`.
