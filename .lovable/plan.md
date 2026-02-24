

# Filtrer l'éco-contribution par plateforme (Uber / Deliveroo / Global)

## Problème

Actuellement, la page Éco-Contribution affiche toujours les données des deux plateformes mélangées, quel que soit l'onglet sélectionné (Uber Eats, Deliveroo, Global). C'est trompeur : sur l'onglet Deliveroo, on voit des lignes Uber et inversement.

## Solution

Propager le `selectedPlatform` depuis le contexte Analytics jusqu'au composant `EcoContributionSection`, puis filtrer les données en conséquence.

## Modifications

### 1. `src/pages/Analytics.tsx`
- Passer la prop `selectedPlatform` au composant `EcoContributionSection`

### 2. `src/components/analytics/EcoContributionSection.tsx`
- Ajouter `selectedPlatform` dans l'interface des props
- Passer cette valeur au hook `useEcoContribution`

### 3. `src/hooks/useEcoContribution.ts`
- Ajouter le paramètre `platform?: "uber_eats" | "deliveroo" | "global"` aux options du hook
- **Onglet "uber_eats"** : exécuter uniquement les requêtes `payouts` et `payout_adjustments` (Uber). Désactiver la requête `deliveroo_orders` (`enabled: false`)
- **Onglet "deliveroo"** : exécuter uniquement la requête `deliveroo_orders`. Désactiver les requêtes Uber (`enabled: false`)
- **Onglet "global"** : exécuter les trois requêtes (comportement actuel)
- Adapter les agrégations (`monthlyData`, `byRestaurant`, `totals`) pour ne prendre en compte que les sources actives

### 4. `src/components/analytics/EcoContributionDetail.tsx`
- Sur l'onglet **Global** : afficher les badges plateforme (Uber / Deliveroo) comme actuellement
- Sur l'onglet **Uber Eats** ou **Deliveroo** : masquer la colonne "Plateforme" (inutile puisque tout est de la même source)

### 5. Drilldown dans `EcoContributionSection.tsx`
- Les petits dots colorés sur les lignes individuelles : même logique — afficher uniquement en mode Global, masquer en mono-plateforme

## Résultat attendu

| Onglet | Données affichées | Badge plateforme |
|--------|-------------------|-----------------|
| Uber Eats | Uniquement `payouts` + `payout_adjustments` | Non |
| Deliveroo | Uniquement `deliveroo_orders` eco-contribution | Non |
| Global | Les deux sources combinées | Oui (distingue Uber/Deliveroo) |

