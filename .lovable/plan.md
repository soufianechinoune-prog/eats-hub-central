

## Comprendre la demande

Tu veux un nouveau mode de vue **"Année"** dans le tableau Comparatif de Rentabilité. Au lieu d'afficher des lignes par mois (Janvier 2026, Février 2026…), ce mode afficherait des **lignes par année** (2024, 2025, 2026) avec les données agrégées sur l'année entière.

## Problème principal

Actuellement, les données sont fetchées **uniquement pour l'année sélectionnée** (`selectedYear`). Pour une vue "Année" montrant 2024/2025/2026, il faut charger les données de **plusieurs années**.

## Plan

### 1. Ajouter le mode "Année" au toggle de vues

Dans `ProfitabilityComparisonTable.tsx` :
- Étendre le type `ViewMode` : `'profitability' | 'week' | 'month' | 'year'`
- Ajouter un bouton "Année" à côté de "Mois" et "Semaine" dans le header

### 2. Fetcher les données multi-années dans Analytics.tsx

Quand le viewMode est `year`, modifier les queries de payouts pour charger **3 années** (selectedYear, selectedYear-1, selectedYear-2) au lieu d'une seule :
- Dupliquer les appels `get_monthly_payouts_detail` pour les 2 années précédentes
- Combiner les résultats avant de les passer au tableau
- Même logique pour `advertisingData` et les payouts Deliveroo

### 3. Créer la logique d'agrégation par année

Dans `ProfitabilityComparisonTable.tsx`, ajouter un `yearGroups` (useMemo) similaire à `monthGroups` :
- Grouper les `comparisonData` par `year`
- Agréger : CA total, versement, commissions, promos, remboursements, éco-contribution, pub
- Calculer la rentabilité selon la base choisie (brut/net)
- Trier par année décroissante
- Support de l'expansion pour voir le détail par restaurant

### 4. Rendre le tableau en mode "Année"

Ajouter le rendu JSX pour le mode `year` :
- Ligne principale : "2026", "2025", "2024" avec les agrégats
- Expansion : sous-lignes par restaurant (comme le mode mois actuel)
- Ligne "Total" en bas avec la somme des années affichées
- Bouton loupe pour drill-down vers la vue mensuelle de l'année

### 5. Masquer le sélecteur d'année en mode "Année"

Le widget `< 2026 >` n'a plus de sens dans ce mode puisqu'on affiche toutes les années disponibles. Le masquer quand `viewMode === 'year'`.

