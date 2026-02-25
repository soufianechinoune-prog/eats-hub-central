

# Afficher les métriques opérationnelles Uber dans les sous-lignes

## Problème
Les sous-lignes Uber Eats affichent "—" pour Note, Erreurs, Prépa+Livr et Inactivité, alors que ces données existent déjà au niveau du restaurant (elles sont 100% Uber). Il suffit de les passer à la sous-ligne Uber.

## Logique
Les métriques opérationnelles (`rating`, `errorRate`, `prepTime`/`totalDeliveryTime`, `downtime`) sont exclusivement Uber Eats. La ligne parent les affiche déjà. Il faut simplement les transmettre à `PlatformSubRow` pour la ligne Uber, et garder "—" pour Deliveroo.

## Modifications

### `src/components/overview/RestaurantComparisonTable.tsx`

1. **Étendre les props de `PlatformSubRow`** : ajouter des props optionnelles pour les métriques opérationnelles :
   - `rating?: number | null`
   - `errorRate?: number | null`
   - `prepTime?: number | null` (totalDeliveryTime)
   - `downtime?: number | null`

2. **Dans le rendu des sous-lignes** (lignes 114-118) : si `isUber` et que les valeurs sont fournies, afficher les vraies valeurs avec le même formatage que la ligne parent (note avec ★, erreurs en %, temps en min, inactivité en h). Sinon garder "—".

3. **Lors de l'appel** (lignes 340-345) : passer `rating={resto.rating}`, `errorRate={resto.errorRate}`, `prepTime={resto.totalDeliveryTime}`, `downtime={resto.downtime}` uniquement à la sous-ligne Uber.

### Résultat visuel

```text
▸ 1  Chicken Street   104 893 €  64 178 €  61.2%  4 550  23.05 €  ★ —  0.0%  16min  —
      [Uber Eats]       80 485 €  46 800 €  58.1%  3 383  23.79 €  ★ —  0.0%  16min  —
      [Deliveroo]       24 408 €  17 378 €  71.2%  1 167  20.92 €   —    —     —     —
```

