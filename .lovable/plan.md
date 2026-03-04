

# Ajouter un champ de recherche dans le tableau comparatif des restaurants

## Changement
Ajouter un `Input` de recherche dans le `CardHeader` du composant `RestaurantComparisonTable`, à côté du toggle N-1. Le filtre s'appliquera sur le nom du restaurant (filtrage côté client via `useMemo`).

## Détail technique
1. **Fichier** : `src/components/overview/RestaurantComparisonTable.tsx`
2. Ajouter un état `searchQuery` avec `useState("")`
3. Ajouter un `Input` avec icône `Search` dans le header, entre le titre et le toggle N-1
4. Filtrer `sortedStats` par `searchQuery` avant le rendu (filtre insensible à la casse sur `resto.name`)
5. Style compact : petit champ ~200px avec placeholder "Rechercher..."

Aucune modification de base de données requise.

