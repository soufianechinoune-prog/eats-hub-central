

# Plan : Simulateur Multi-Restaurant avec Prix Réels

## Contexte

Actuellement, le simulateur d'offres (BOGO, Cross-Product, etc.) utilise les prix du **catalogue global** (`menu_items`), mais les prix réels varient par restaurant dans la table `restaurant_menu_prices`.

**Exemple concret de la base de données :**
| Produit | Catalogue | Antony | Athis | Bonneuil | Juvisy |
|---------|-----------|--------|-------|----------|--------|
| Frites | 3,75 € | 3,57 € | 3,75 € | 3,75 € | 3,75 € |
| Burger Dynamite | - | 12,14 € | 10,70 € | 11,36 € | 10,70 € |

## Solution proposée

Ajouter un **sélecteur de restaurants** au simulateur et afficher les **résultats par restaurant** avec leurs prix réels.

### Architecture visuelle

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    1 acheté = 1 offert (BOGO)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  NOUVEAU : Restaurants concernés                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [Antony ×] [Athis ×] [Juvisy ×]                    [▼]     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Configuration                    │   Résultats par Restaurant      │
│  ┌───────────────────────────┐   │   ┌─────────────────────────┐   │
│  │ Produit: [Menu Naan  ▼]   │   │   │ ANTONY      14,50€      │   │
│  │ Commission: [27%     ━━]  │   │   │ Marge BOGO: +2,15€      │   │
│  │ Frais: [0,89€         ]   │   │   │ Seuil: +68%  ✅ Go      │   │
│  │ ...                       │   │   ├─────────────────────────┤   │
│  └───────────────────────────┘   │   │ ATHIS       13,90€      │   │
│                                   │   │ Marge BOGO: +1,85€      │   │
│                                   │   │ Seuil: +82%  ⚠️ Risqué  │   │
│                                   │   ├─────────────────────────┤   │
│                                   │   │ JUVISY      13,90€      │   │
│                                   │   │ Marge BOGO: +1,85€      │   │
│                                   │   │ Seuil: +82%  ⚠️ Risqué  │   │
│                                   │   └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Fichiers à modifier/créer

### 1. Nouveau hook : `src/hooks/useSimulatorRestaurantPrices.ts`

Ce hook enrichit les `menuItems` avec les prix spécifiques aux restaurants sélectionnés.

**Fonction :**
- Entrée : `menuItems[]`, `restaurantIds[]`, `platform`
- Sortie : `enrichedItems[]` avec structure :
  ```typescript
  interface EnrichedMenuItem {
    id: string;
    name: string;
    category: string | null;
    food_cost: number | null;
    is_active: boolean;
    // Prix par restaurant
    prices: {
      restaurantId: string;
      restaurantName: string;
      price: number | null;      // Prix spécifique
      catalogPrice: number | null; // Prix catalogue (fallback)
      usedPrice: number | null;   // Prix utilisé (spécifique ou fallback)
      hasDifference: boolean;
    }[];
  }
  ```

### 2. Modifier : `src/components/menu/OfferSimulator.tsx`

**Ajouts :**
- State `selectedRestaurantIds: string[]`
- Charger la liste des restaurants via query Supabase
- Ajouter le composant `RestaurantSelector` en haut du simulateur
- Passer `restaurantIds` aux simulateurs enfants

### 3. Modifier : `src/components/menu/offers/BogoSimulator.tsx`

**Modifications majeures :**

1. **Nouvelles props :**
   ```typescript
   interface BogoSimulatorProps {
     menuItems: MenuItem[];
     restaurantIds: string[];  // NOUVEAU
     onBack: () => void;
     platform: Platform;
     commission: number;
     onCommissionChange: (value: number) => void;
   }
   ```

2. **Calcul par restaurant :**
   - Pour chaque restaurant sélectionné, calculer :
     - Prix réel du produit
     - Marge BOGO
     - Seuil de rentabilité
     - Recommandation (Go/Risqué/Stop)

3. **Nouvelle section "Résultats par Restaurant" :**
   - Afficher les résultats sous forme de cartes par restaurant
   - Code couleur selon la rentabilité
   - Afficher le delta de prix vs catalogue si différent

4. **Classement intelligent adapté :**
   - Le classement BOGO affiche les résultats **groupés par restaurant** ou **comparatifs**

### 4. Appliquer aux autres simulateurs

Mêmes modifications pour :
- `CrossProductSimulator.tsx`
- `PercentDiscountSimulator.tsx`

---

## Détails techniques

### Logique de sélection des prix

```typescript
function getRestaurantPrice(
  menuItemId: string, 
  restaurantId: string,
  platform: Platform,
  restaurantMenuPrices: RestaurantMenuPrice[],
  catalogPrice: number | null
): number | null {
  // Chercher le prix spécifique au restaurant
  const restaurantPrice = restaurantMenuPrices.find(
    rmp => rmp.menu_item_id === menuItemId && rmp.restaurant_id === restaurantId
  );
  
  if (restaurantPrice) {
    const price = platform === "uber" 
      ? restaurantPrice.price_uber 
      : restaurantPrice.price_deliveroo;
    if (price !== null) return price;
  }
  
  // Fallback sur le catalogue
  return catalogPrice;
}
```

### Calcul des résultats par restaurant

```typescript
interface RestaurantSimulationResult {
  restaurantId: string;
  restaurantName: string;
  price: number;
  priceSource: "restaurant" | "catalog";
  foodCost: number;
  netMarginPerUnit: number;
  netMarginBogo: number;
  marginPercentBogo: number;
  breakevenIncreasePercent: number | null;
  recommendation: "recommended" | "moderate" | "not_recommended";
}

// Pour chaque restaurant sélectionné
const results: RestaurantSimulationResult[] = restaurantIds.map(restId => {
  const price = getRestaurantPrice(productId, restId, platform, prices, catalogPrice);
  // ... calculs de marge et recommandation
  return { restaurantId: restId, ... };
});
```

### Affichage multi-restaurant

Nouvelle section dans le panneau de résultats :

```tsx
{/* Résultats par Restaurant */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Store className="h-5 w-5" />
      Résultats par Restaurant
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-3">
      {restaurantResults.map(result => (
        <div key={result.restaurantId} className={`p-4 rounded-lg border ${getRecommendationStyle(result.recommendation)}`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold">{result.restaurantName}</span>
              {result.priceSource === "catalog" && (
                <Badge variant="outline" className="ml-2 text-xs">Prix catalogue</Badge>
              )}
            </div>
            <span className="font-mono">{result.price.toFixed(2)}€</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Marge BOGO</span>
              <div className={getMarginColor(result.netMarginBogo)}>
                {result.netMarginBogo > 0 ? "+" : ""}{result.netMarginBogo.toFixed(2)}€
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Seuil</span>
              <div>+{result.breakevenIncreasePercent?.toFixed(0)}%</div>
            </div>
            <div className="flex items-center justify-end">
              {getRecommendationBadge(result.recommendation)}
            </div>
          </div>
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

---

## Comportement UX

### Sans restaurant sélectionné
- Le simulateur utilise les prix du **catalogue global** (comportement actuel)
- Message : "Sélectionnez des restaurants pour voir les résultats par établissement"

### Avec restaurants sélectionnés
- Afficher les **résultats par restaurant** avec leurs prix réels
- Indicateur visuel si le prix diffère du catalogue
- Vue comparative pour identifier les restaurants les plus/moins rentables

### Classement intelligent multi-restaurant
- Le tableau de classement peut afficher :
  - **Vue globale** : moyenne des résultats sur les restaurants sélectionnés
  - **Vue détaillée** : résultats par restaurant (accordéon)

---

## Résumé des modifications

| Fichier | Type | Description |
|---------|------|-------------|
| `src/hooks/useSimulatorRestaurantPrices.ts` | Nouveau | Hook pour charger les prix par restaurant |
| `src/components/menu/OfferSimulator.tsx` | Modifier | Ajouter sélecteur de restaurants |
| `src/components/menu/offers/BogoSimulator.tsx` | Modifier | Calculs et affichage multi-restaurant |
| `src/components/menu/offers/CrossProductSimulator.tsx` | Modifier | Idem |
| `src/components/menu/offers/PercentDiscountSimulator.tsx` | Modifier | Idem |

---

## Résultat attendu

1. **Sélection de restaurants** en haut du simulateur (réutilise le composant existant)
2. **Prix réels** utilisés pour les calculs (depuis `restaurant_menu_prices`)
3. **Résultats comparatifs** par restaurant avec indicateurs visuels
4. **Identification rapide** des restaurants où l'offre est rentable vs risquée
5. **Fallback intelligent** vers les prix catalogue si aucun prix spécifique n'existe

