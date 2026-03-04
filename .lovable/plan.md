

# Refonte radicale — Éco-Contribution

## Corrections
1. **Remettre les boutons année** : Restaurer les boutons `Historique | 2023 | 2024 | 2025 | 2026` avec un état local `localYear` (valeur initiale = `selectedYear` du contexte global). Ces boutons pilotent la requête de données, indépendamment du header global.

## Refonte visuelle — layout totalement repensé

### Zone haute : Bandeau statut full-width
Un bandeau coloré horizontal (vert si exonéré, rouge sinon) avec :
- Icône + titre "Éco-Contribution 2025"
- Badge statut (Exonéré / Non exonéré)
- Boutons année intégrés dans ce bandeau (pilules)
- Export à droite

### Zone KPI : Dashboard-style en 2 rangées
**Rangée 1** — Grande carte "Solde Net" en pleine largeur avec :
- Le montant en très gros (4xl)
- À droite dans la même carte : 3 mini-KPI en ligne (Remboursements, Prélèvements, Lignes) — façon "stat strip"
- Barre de progression pleine largeur en bas de la carte montrant le ratio remb/prél

**Rangée 2** — 2 cartes côte à côte :
- **Gauche** : Gauge circulaire SVG (taux de récupération) + coût moyen/ligne
- **Droite** : Top 3 / Flop 3 en colonnes compactes côte à côte dans la même carte (pas 2 cartes séparées)

### Zone graphique
- Graphique inchangé fonctionnellement mais intégré dans une carte avec un fond subtil et hauteur 350px

### Zone tableau
- Carte avec search + filtres pilules, comme actuellement mais avec des lignes plus aérées
- Tabs Synthèse / Détail en pilules au-dessus du tableau (pas au-dessus de tout)

## Structure technique

Le composant `EcoContributionSection.tsx` sera réécrit avec :
- `localYear` state restauré (boutons Historique/année)
- Nouveau layout en sections visuelles distinctes
- Mêmes données, même hook `useEcoContribution`, mêmes sous-composants `RestaurantDrilldown` et `MonthDrilldownRow`

## Fichier modifié
- `src/components/analytics/EcoContributionSection.tsx`

Aucune modification de base de données.

