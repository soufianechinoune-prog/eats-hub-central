
# Uber One : Liste complete et Comportement enrichi

## 1. Enrichir le tableau "Comportement compare"

Actuellement le tableau ne montre que 2 metriques (Panier moyen, Volume). On va ajouter des metriques supplementaires deja disponibles dans les donnees RPC :

- **CA total** : chiffre d'affaires Uber One vs Standard
- **Panier moyen** : deja present
- **Volume** : deja present  
- **Part du CA** : pourcentage du CA genere par chaque segment

Ces donnees sont deja remontees par le RPC `get_uber_one_stats` (champs `uber_one_revenue`, `non_uber_one_revenue`), il suffit de les exploiter dans le hook.

## 2. Liste complete des restaurants (pleine largeur, triable)

Remplacer le graphique horizontal actuel "Comparaison par restaurant" par un **tableau pleine largeur** place sous le bloc "Comportement compare". Ce tableau affichera :

| Restaurant | % Uber One | Uber One | Standard | Total | Panier UO | Panier Std |
|---|---|---|---|---|---|---|

Fonctionnalites :
- **Pleine largeur** (pas de grille 2 colonnes)
- **Tri par colonne** en cliquant sur les en-tetes (% Uber One, Volume, Panier...)
- Indicateur de significativite (icone warning si moins de 10 commandes)
- Noms raccourcis avec tooltip pour le nom complet

## Detail technique

### Fichier : `src/hooks/useUberOneStats.ts`
- Ajouter dans le tableau `comparison` les metriques "CA total" et "Part du CA"
- Ajouter dans `byRestaurant` les champs `uberOneBasket` et `nonUberOneBasket` (calcules a partir des revenus et counts deja disponibles dans le RPC)

### Fichier : `src/components/analytics/UberOneAnalysis.tsx`
- Supprimer la carte "Comparaison par restaurant" (graphique barres horizontales) de la grille 2 colonnes
- Garder le tableau "Comportement compare" dans sa grille actuelle mais en pleine largeur (`lg:col-span-2`)
- Ajouter en dessous (hors grille) une nouvelle section "Classement par restaurant" en pleine largeur avec :
  - Un tableau HTML triable (state local `sortField` + `sortDirection`)
  - Colonnes : Restaurant, % Uber One, Commandes UO, Commandes Std, Total, Panier UO, Panier Std
  - Clic sur en-tete pour trier asc/desc
  - Barres de progression inline pour le % Uber One
  - Badge warning pour les restaurants non significatifs
