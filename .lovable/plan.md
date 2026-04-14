

# Deux modifications sur l'onglet Conversion

## 1. Supprimer la carte "CA par Visite"

**Fichier** : `src/components/analytics/AnalyticsCharts.tsx` (~ligne 3364)

Retirer le composant `<RevenuePerVisitKPI />` et passer le layout de `grid-cols-3` à pleine largeur pour le `<ConversionLeakyBucket />` uniquement (suppression de la colonne droite).

## 2. Afficher tous les restaurants dans "Classement par Étape"

**Fichier** : `src/components/analytics/ConversionRankingByStage.tsx` (~ligne 63)

Actuellement limité à `.slice(0, 10)` (top 10). Remplacer par :
- Un état `showAll` (défaut `false`)
- Afficher les 10 premiers par défaut
- Ajouter un bouton "Voir les N restaurants" en bas qui bascule `showAll` et affiche la liste complète dans un `ScrollArea` avec hauteur max (~400px) pour rester lisible
- Quand la liste est dépliée, un bouton "Réduire" permet de revenir au top 10

