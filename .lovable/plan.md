

# Amélioration de la section Tableau Restaurants (Zone 5)

## Problème
La section tableau (Synthèse/Détail) manque de hiérarchie visuelle. Les lignes sont tassées, la barre de progression du solde est trop petite (w-20), et le design global est plat.

## Changements prévus dans `EcoContributionSection.tsx`

### 1. Header du tableau plus structuré
- Séparer visuellement les tabs (Synthèse/Détail) et les filtres sur deux niveaux quand l'espace est restreint
- Ajouter un compteur de résultats visible sous les filtres

### 2. Lignes du tableau améliorées
- **Barre de solde élargie** : passer de `w-20` a `w-28` avec une hauteur de 2.5px et des couleurs plus marquées (fond rouge/vert selon le signe)
- **Espacement des lignes** : padding vertical augmenté (`py-3`) pour plus d'aération
- **Indicateur visuel de statut** : petit dot vert/rouge avant le nom du restaurant pour signaler immédiatement le statut d'exonération
- **Hover effect** plus prononcé avec une transition douce

### 3. Drilldown (sous-lignes mois et lignes individuelles)
- Fond légèrement différencié avec une bordure gauche colorée (verte ou rouge selon le solde du restaurant) pour créer une "groupement visuel"
- Lignes de détail avec un fond alterné plus subtil

### 4. Bouton "Voir tout" amélioré
- Remplacer le ghost button par un bouton outline avec un compteur badge

### Fichier modifié
- `src/components/analytics/EcoContributionSection.tsx` (zone 5 uniquement, lignes ~499-783)

