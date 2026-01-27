

# Correction de l'affichage Uber One - Seuil de significativité

## Analyse du problème

L'affichage "100% Uber One" pour Antony est techniquement correct mais trompeur. Voici ce qui se passe :

1. **Données limitées** : Les données order_history s'arrêtent au 18 janvier 2026
2. **Période sans données** : Si l'utilisateur sélectionne "Semaine précédente" (20-26 janvier), il n'y a quasiment pas de données
3. **Échantillon trop petit** : Avec seulement quelques commandes, les pourcentages peuvent être extrêmes (ex: 2 commandes Uber One = 100%)

## Solution proposée

Ajouter un seuil de significativité pour éviter d'afficher des pourcentages trompeurs basés sur des échantillons trop petits.

### Modifications

#### 1. Fichier `src/hooks/useUberOneStats.ts`

Ajouter un indicateur de significativité aux données par restaurant :

```typescript
// Dans l'interface UberOneByRestaurant
export interface UberOneByRestaurant {
  // ... existing fields
  isSignificant: boolean; // true if totalOrders >= SIGNIFICANCE_THRESHOLD
}

// Ajouter une constante pour le seuil
const SIGNIFICANCE_THRESHOLD = 10; // Minimum 10 commandes pour être significatif

// Dans le calcul byRestaurant (lignes 316-329)
return {
  restaurantId,
  restaurantName: restaurantMap[restaurantId] || "Inconnu",
  uberOnePercent: total > 0 ? (data.uberOne / total) * 100 : 0,
  uberOneCount: data.uberOne,
  nonUberOneCount: data.nonUberOne,
  totalOrders: total,
  isSignificant: total >= SIGNIFICANCE_THRESHOLD, // NEW
};
```

#### 2. Fichier `src/components/analytics/UberOneAnalysis.tsx`

Ajouter un indicateur visuel pour les échantillons non significatifs :

- Afficher un badge d'avertissement sur les restaurants avec peu de données
- Utiliser une couleur différente (gris/hachuré) pour les barres non significatives
- Ajouter un tooltip explicatif

```tsx
// Dans le graphique Comparaison par restaurant
<Bar dataKey="uberOnePercent" radius={[0, 4, 4, 0]} maxBarSize={35}>
  {byRestaurant.map((entry, index) => (
    <Cell
      key={`cell-${index}`}
      fill={
        entry.isSignificant 
          ? (index === 0 ? "hsl(var(--chart-1))" : "hsl(var(--chart-1) / 0.7)")
          : "hsl(var(--muted))" // Grisé si non significatif
      }
    />
  ))}
</Bar>
```

#### 3. Message d'avertissement global

Si la majorité des restaurants ont des échantillons non significatifs, afficher une alerte :

```tsx
// Avant le graphique
{byRestaurant.filter(r => !r.isSignificant).length > byRestaurant.length / 2 && (
  <Alert variant="default" className="mb-4">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      Données insuffisantes sur cette période. Les pourcentages peuvent être peu représentatifs.
    </AlertDescription>
  </Alert>
)}
```

## Résumé des fichiers à modifier

| Fichier | Modification |
|---------|--------------|
| `src/hooks/useUberOneStats.ts` | Ajouter `isSignificant` et `SIGNIFICANCE_THRESHOLD` |
| `src/components/analytics/UberOneAnalysis.tsx` | Indicateur visuel + message d'avertissement |

## Résultat attendu

- Les restaurants avec moins de 10 commandes seront affichés en gris
- Un message d'avertissement apparaîtra si les données sont insuffisantes
- L'utilisateur comprendra que le 100% est dû à un échantillon trop petit

