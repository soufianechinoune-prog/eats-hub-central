
# Ajouter la colonne "Pub" (depenses publicitaires) au Comparatif de Rentabilite

## Objectif

Integrer les depenses publicitaires depuis la table `payout_adjustments` (category = 'advertising') dans le tableau "Comparatif de Rentabilite" de la page Finances & Frais. La colonne s'affichera entre "Eco-contrib." et "Versement Total", en respectant les filtres temporels et restaurant existants.

## Donnees disponibles

- Table `payout_adjustments` : 1 364 lignes de pub totalisant -244 152 EUR
- Cle de jointure : `payout_date` + `restaurant_id` (identique aux payouts)
- Les montants sont negatifs (depenses)

## Plan d'implementation

### 1. Requeter les depenses publicitaires (Analytics.tsx)

Ajouter une requete `payout_adjustments` filtree par `category = 'advertising'` avec les memes filtres temporels et restaurant que `dailyPayoutsData`. Agreger par `payout_date` + `restaurant_id` pour obtenir le total pub par versement. Passer ces donnees a `FinancesSection` puis a `ProfitabilityComparisonTable`.

### 2. Modifier FinancesSection.tsx

Ajouter la prop `advertisingData` et la transmettre a `ProfitabilityComparisonTable`.

### 3. Modifier ProfitabilityComparisonTable.tsx

- Ajouter une interface pour les donnees pub et une nouvelle prop
- Dans `comparisonData` (useMemo), joindre les depenses pub par `payout_date` + `restaurant_id`
- Ajouter le champ `advertisingAmount` a `ComparisonRow`
- Ajouter une colonne "Pub" dans le header (entre Eco-contrib. et Versement Total), en rouge/orange
- Afficher le montant dans chaque ligne de donnees (mode profitabilite, semaine, mois)
- Integrer dans les calculs de moyenne
- Le montant s'affiche toujours en valeur absolue avec un signe "-" car c'est une depense

### 4. Impact sur les vues

Les 3 vues (Rentabilite, Semaine, Mois) afficheront la colonne Pub. La ligne "Moyenne" inclura egalement la moyenne des depenses publicitaires.

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| `src/pages/Analytics.tsx` | Nouvelle requete `payout_adjustments` filtree advertising, passee a FinancesSection |
| `src/components/analytics/FinancesSection.tsx` | Nouvelle prop `advertisingData`, transmise au tableau |
| `src/components/analytics/ProfitabilityComparisonTable.tsx` | Nouvelle colonne "Pub" dans les 3 modes de vue + moyenne |
