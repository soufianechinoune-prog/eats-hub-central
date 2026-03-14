

## Problème : Vue Finances vide quand Deliveroo est sélectionné

### Diagnostic

Quand tu sélectionnes **Deliveroo** dans l'onglet Finances & Frais, deux éléments sont absents :

1. **Le tableau "Comparatif de Rentabilité"** — il dépend de `dailyPayoutsData` qui provient de la query `deliverooPayoutsData`. Cette query est bien activée (`enabled: true`), mais elle pagine potentiellement des dizaines de milliers de lignes Deliveroo sur 3 ans sans aucun indicateur de chargement. Le composant affiche simplement "rien" tant que les données ne sont pas chargées (`dailyPayoutsData.length > 0`).

2. **Le graphique "Comparatif de Rentabilité"** (ProfitabilityComparisonChart) — il utilise `useFinancesDrilldown` qui supporte bien Deliveroo, donc il devrait fonctionner une fois le chargement terminé.

**Causes identifiées** :

- **Pas de loading state** pour `deliverooPayoutsData` — la query n'expose pas `isLoading`, donc aucun spinner pendant le chargement
- **Volume de données** : 3 ans de `deliveroo_orders` avec pagination par 1000 = potentiellement 15-20 requêtes séquentielles avant d'avoir toute la data
- Le `payoutsData` mensuel (utilisé pour les KPI sommaires dans AnalyticsCharts) vient uniquement de `get_monthly_payouts_summary` qui ne requête que la table `payouts` (Uber) — pas de données mensuelles Deliveroo agrégées

### Plan de correction

#### 1. Ajouter un loading state pour `deliverooPayoutsData`
Dans `Analytics.tsx`, tracker `isLoading` sur la query `deliverooPayoutsData` et le passer au composant pour afficher un spinner pendant le chargement.

#### 2. Générer un `payoutsData` équivalent pour Deliveroo
Créer un `effectivePayoutsData` qui, quand Deliveroo est sélectionné, agrège les `deliverooPayoutsData` par mois/restaurant pour alimenter les KPIs et graphiques mensuels qui en dépendent (comme le fait `payoutsData` pour Uber).

#### 3. Passer les données effectives au composant
S'assurer que `AnalyticsCharts` reçoit les bonnes `payoutsData` et `prevPayoutsData` selon la plateforme sélectionnée, comme c'est déjà fait pour `dailyPayoutsData` via `effectiveDailyPayoutsData`.

### Fichiers modifiés

- **`src/pages/Analytics.tsx`** :
  - Ajouter `isLoading` sur la query `deliverooPayoutsData` (~ligne 342)
  - Créer un `effectivePayoutsData` et `effectivePrevPayoutsData` qui sélectionnent les données Uber ou Deliveroo selon la plateforme
  - Agréger `deliverooPayoutsData` par mois pour créer un équivalent de `payoutsData` pour Deliveroo
  - Passer le loading state au composant pour afficher un spinner

### Impact

- Le tableau "Comparatif de Rentabilité" apparaîtra pour Deliveroo avec toutes les données financières
- Un spinner sera affiché pendant le chargement des données Deliveroo
- Les KPIs mensuels refléteront les données Deliveroo quand la plateforme est sélectionnée

