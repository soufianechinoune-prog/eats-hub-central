## Objectif
Afficher visuellement la **provenance des données** (Uber API vs CSV) à côté du nom de chaque restaurant dans `RestaurantComparisonTable`, avec un toggle global pour masquer/afficher les badges. Permet de vérifier dès maintenant les ~2M commandes déjà étiquetées (`uber_api` + `csv_import`) pendant que le backfill des `NULL` tourne en arrière-plan.

## Architecture

```text
Overview.tsx
  ├── useDataSourceBreakdown(restaurantIds, from, to)   ← nouveau hook
  │     └── RPC get_orders_data_source_breakdown        ← déjà déployée
  └── <RestaurantComparisonTable
         dataSourceMap={...}      ← nouveau prop
         showDataSource={bool}    ← nouveau prop (toggle)
         onToggleDataSource={fn}  ← nouveau prop
       />
            └── <DataSourceBadge source="uber_api" | "csv_import" | "mixed" />
```

## Composants à créer / modifier

### 1. `src/components/overview/DataSourceBadge.tsx` (nouveau)
Petit badge compact qui affiche la source dominante d'un restaurant sur la période :

- `uber_api` → badge violet "API" (icône `Zap`), tooltip "Données API Uber Eats (temps réel)"
- `csv_import` → badge slate "CSV" (icône `FileText`), tooltip "Données issues d'un import CSV"
- `mixed` → badge bicolore "API+CSV", tooltip "Mix API + CSV sur la période"

Utilise les tokens sémantiques (`bg-primary/10 text-primary`, `bg-muted text-muted-foreground`). Pas de couleurs hard-codées.

```tsx
type DataSource = 'uber_api' | 'csv_import' | 'mixed';
interface Props { source: DataSource; revenueShare?: number; }
```

### 2. `src/hooks/useDataSourceBreakdown.ts` (nouveau)
React Query hook qui appelle la RPC existante `get_orders_data_source_breakdown(restaurant_ids, start, end)` et renvoie une map :

```ts
Map<restaurant_id, {
  dominantSource: 'uber_api' | 'csv_import' | 'mixed',
  uberRevenue: number,
  csvRevenue: number,
  uberShare: number,  // 0..1
}>
```

Règles :
- `uberShare >= 0.95` → `uber_api`
- `uberShare <= 0.05` → `csv_import`
- sinon → `mixed`
- Garde sentinel UUID `'0000...'` (analytics-ready guard).
- `enabled: showDataSource && restaurantIds.length > 0`.

### 3. `RestaurantComparisonTable.tsx` (modifier)
- Ajouter props `showDataSource: boolean`, `onToggleDataSource: (v: boolean) => void`, `dataSourceMap?: Map<string, ...>`.
- Ajouter un `<Switch>` "Afficher la source des données" dans la barre d'en-tête de la table (à côté du toggle N-1 existant).
- Dans la cellule nom (ligne 364-366), afficher le `<DataSourceBadge>` à droite du nom **uniquement si `showDataSource`**.
- Ne **pas** modifier la logique de tri ni les autres colonnes.

### 4. `src/pages/Overview.tsx` (modifier)
- Ajouter `const [showDataSource, setShowDataSource] = useState(true);`
- Appeler `useDataSourceBreakdown(restaurantIds, dateRange.from, dateRange.to)`.
- Brancher les 3 props sur `<RestaurantComparisonTable>`.

## Hors scope
- Pas de patch des edge functions Uber/CSV (l'écriture du `data_source` à l'insert est Phase 2).
- Pas de badges dans Overview KPI cards ni dans Finances (Phase 2).
- Pas de relance du backfill des NULL (continue en arrière-plan).

## Validation visuelle attendue
- Restaurants avec connexion API active depuis longtemps → badge violet "API".
- Restaurants importés uniquement par CSV → badge gris "CSV".
- Restaurants en cours de bascule (historique CSV + API récente) → "API+CSV".
- Restaurants encore `NULL` (non backfillés) → afficheront "CSV" car `COALESCE(o.data_source, 'csv_import')` dans la RPC.

## Risque
Aucun : lecture seule via RPC `SECURITY DEFINER` déjà en place + index `idx_orders_data_source`. Toggle OFF par défaut possible si jamais la RPC est lente sur grosses périodes — à confirmer.
