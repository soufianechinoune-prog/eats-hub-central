
# Deux vues distinctes : % Food Cost et Marge

## Problème actuel
Le tableau affiche une colonne "% FC" avec une **moyenne** des restaurants, mais le vrai ratio Food Cost / Prix HT est **différent par restaurant** car les prix varient. Un produit avec un food cost de 3€ a :
- 25% FC si vendu à 12€ HT à Athis-Mons
- 20% FC si vendu à 15€ HT à Antony

## Solution proposée

Ajouter un sélecteur de vue avec deux modes d'affichage exclusifs :

```text
┌────────────────────────────────────────────────────────────────┐
│  Vue :  [ % Food Cost ]  [ Marge ]                             │
├────────────────────────────────────────────────────────────────┤
│  Produit │ Food Cost │ CS Athis │ CS Antony │ Moyenne │ Écart  │
├──────────┼───────────┼──────────┼───────────┼─────────┼────────┤
│  Burger  │   3.00€   │   25%    │    20%    │   22%   │   5%   │
└────────────────────────────────────────────────────────────────┘
```

### Vue "% Food Cost"
- Colonnes restaurants : affichent `Food Cost / Prix HT × 100` pour chaque restaurant
- Colonne Moyenne : moyenne du % FC sur tous les restaurants sélectionnés
- Colonne Écart : différence max-min du % FC entre restaurants
- Code couleur : vert < 30%, orange 30-35%, rouge > 35%
- Légende adaptée aux seuils Food Cost

### Vue "Marge" (existante)
- Conserve le comportement actuel avec toggle Brute/Nette
- Colonnes restaurants : marge brute ou nette selon le toggle
- Colonne Moyenne : marge moyenne
- Colonne Écart : écart de marge
- Code couleur : vert ≥ 70%, orange 50-70%, rouge < 50%

## Modifications techniques

### Fichier : `src/components/menu/ProfitabilityComparison.tsx`

#### 1. Nouveau state pour le mode de vue
```typescript
type ViewMode = "foodCost" | "margin";
const [viewMode, setViewMode] = useState<ViewMode>("margin");
```

#### 2. Nouveau toggle dans l'interface
Remplacer le toggle Brute/Nette actuel par un système à deux niveaux :
```text
[ % Food Cost ] [ Marge ]    // Premier niveau : choix de vue
                [ Brute ] [ Nette ] ℹ️  // Second niveau : visible seulement en mode Marge
```

#### 3. Calcul du % FC par restaurant
Nouvelle fonction pour calculer le % FC spécifique à chaque restaurant :
```typescript
const getRestaurantFoodCostPercent = (item: ProductProfitability, restaurantId: string): number | null => {
  if (item.foodCost === null) return null;
  const r = item.restaurants.find(rest => rest.restaurantId === restaurantId);
  if (!r) return null;
  const price = platform === "uber" ? r.priceUber : r.priceDeliveroo;
  if (!price) return null;
  const vatRate = item.vatRate ?? 10;
  const prixHT = price / (1 + vatRate / 100);
  return (item.foodCost / prixHT) * 100;
};
```

#### 4. Calcul de l'écart FC
```typescript
const getFoodCostSpread = (item: ProductProfitability): number | null => {
  const percentages = selectedRestaurantIds
    .map(id => getRestaurantFoodCostPercent(item, id))
    .filter((p): p is number => p !== null);
  if (percentages.length < 2) return null;
  return Math.max(...percentages) - Math.min(...percentages);
};
```

#### 5. Rendu conditionnel des colonnes restaurants
Dans le TableBody, afficher soit le % FC soit la marge selon `viewMode` :
```tsx
{viewMode === "foodCost" ? (
  // Affiche le % Food Cost du restaurant avec code couleur
  <span className={getFoodCostStatus(fcPercent).color}>
    {fcPercent.toFixed(0)}%
  </span>
) : (
  // Affiche la marge (brute ou nette) actuelle
  <span className={getMarginColor(margin)}>
    {margin.toFixed(1)}%
  </span>
)}
```

#### 6. Colonnes Moyenne et Écart adaptatives
- En mode "foodCost" : affiche la moyenne des % FC et l'écart des % FC
- En mode "margin" : comportement actuel (marge moyenne et écart de marge)

#### 7. Légende dynamique
Adapter la légende en bas selon le mode de vue :
- Mode FC : "< 30% (Excellent)", "30-35% (Acceptable)", "> 35% (À surveiller)"
- Mode Marge : "≥ 70% (Excellente)", "50-70% (Correcte)", "< 50% (Faible)"

#### 8. Export Excel adapté
Ajouter les colonnes % FC par restaurant dans l'export quand en mode foodCost.

## Résultat attendu

| Avant | Après |
|-------|-------|
| 1 colonne % FC (moyenne) | N colonnes % FC (par restaurant) |
| Pas de choix de vue | Toggle Vue : Food Cost / Marge |
| Toggle Brute/Nette toujours visible | Toggle Brute/Nette visible seulement en mode Marge |
| Écart = écart de marge | Écart adapté au mode de vue |

## Fichier impacté
- `src/components/menu/ProfitabilityComparison.tsx`
