

# Plan : Affichage du montant en euros du cofinancement

## Objectif
Afficher le montant en euros correspondant au pourcentage de cofinancement dans le panneau de droite (BogoImpactPanel), basé sur le prix HT moyen des articles sélectionnés.

Par exemple : si le cofinancement est de 12% et que le prix HT moyen des articles est de 8,50 €, afficher "12% du prix HT (≈ 1,02 €)"

---

## Modifications techniques

### 1. Ajouter `vat_rate` aux interfaces MenuItem

**Fichier : `src/components/menu/OfferSimulator.tsx`** (ligne 12-20)

```typescript
interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  price_uber: number | null;
  price_deliveroo: number | null;
  food_cost: number | null;
  is_active: boolean;
  vat_rate: number | null;  // AJOUT
}
```

**Fichier : `src/components/menu/offers/BogoSimulatorUber.tsx`** (ligne 23-31)

```typescript
interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  price_uber: number | null;
  price_deliveroo: number | null;
  food_cost: number | null;
  is_active: boolean;
  vat_rate: number | null;  // AJOUT
}
```

---

### 2. Calculer le prix HT moyen des articles sélectionnés

**Fichier : `src/components/menu/offers/BogoSimulatorUber.tsx`**

Ajouter un `useMemo` pour calculer le prix HT moyen :

```typescript
const averageHtPrice = useMemo(() => {
  const selectedItems = menuItems.filter(item => selectedItemIds.includes(item.id));
  if (selectedItems.length === 0) return 0;
  
  const total = selectedItems.reduce((sum, item) => {
    if (!item.price_uber) return sum;
    const vatRate = item.vat_rate ?? 10; // Défaut 10%
    const priceHt = item.price_uber / (1 + vatRate / 100);
    return sum + priceHt;
  }, 0);
  
  return total / selectedItems.length;
}, [menuItems, selectedItemIds]);
```

---

### 3. Passer le prix HT moyen au BogoImpactPanel

**Fichier : `src/components/menu/offers/BogoSimulatorUber.tsx`**

```typescript
<BogoImpactPanel
  restaurantCount={selectedRestaurantIds.length}
  selectedItemsCount={selectedItemIds.length}
  offerFee={OFFER_FEE}
  offerFeeWaived={offerFeeWaived}
  cofinancingType={cofinancingType}
  cofinancingValue={parseFloat(cofinancingValue) || 0}
  averageHtPrice={averageHtPrice}  // AJOUT
/>
```

---

### 4. Afficher le montant en euros dans BogoImpactPanel

**Fichier : `src/components/menu/offers/BogoImpactPanel.tsx`**

Ajouter la prop et calculer le montant :

```typescript
interface BogoImpactPanelProps {
  restaurantCount: number;
  selectedItemsCount: number;
  offerFee: number;
  offerFeeWaived?: boolean;
  cofinancingType?: "percent" | "amount";
  cofinancingValue?: number;
  averageHtPrice?: number;  // AJOUT
}
```

Modifier l'affichage du cofinancement (ligne 153-161) :

```typescript
{cofinancingValue > 0 && (
  <div className="space-y-2">
    <p className="text-sm text-muted-foreground">Cofinancement</p>
    <p className="text-lg font-semibold text-primary">
      {cofinancingType === "percent"
        ? `${cofinancingValue}% du prix HT`
        : `${cofinancingValue.toFixed(2).replace(".", ",")} € par article`}
    </p>
    {/* AJOUT : Montant en euros pour le pourcentage */}
    {cofinancingType === "percent" && averageHtPrice > 0 && (
      <p className="text-sm text-muted-foreground">
        ≈ {((cofinancingValue / 100) * averageHtPrice).toFixed(2).replace(".", ",")} € 
        / article (moy.)
      </p>
    )}
  </div>
)}
```

---

## Résumé des modifications

| Fichier | Modification |
|---------|--------------|
| `src/components/menu/OfferSimulator.tsx` | Ajout `vat_rate` à l'interface |
| `src/components/menu/offers/BogoSimulatorUber.tsx` | Ajout `vat_rate` à l'interface + calcul `averageHtPrice` + passage prop |
| `src/components/menu/offers/BogoImpactPanel.tsx` | Ajout prop `averageHtPrice` + affichage montant euros |

---

## Résultat attendu

Quand l'utilisateur sélectionne un cofinancement de 12% et des articles avec un prix HT moyen de 8,50 € :

```text
Cofinancement
12% du prix HT
≈ 1,02 € / article (moy.)
```

