
# Correction du calcul du cofinancement Uber et affichage Prix HT

## Problème identifié

Actuellement, le cofinancement Uber est calculé sur le **Food Cost**, ce qui est incorrect.

**Logique actuelle (incorrecte)** :
```typescript
platformContribution = foodCost * fundingValue / 100
```

**Logique correcte selon Uber** :
Le cofinancement Uber est calculé sur le **Prix HT** du produit :
```
Prix HT = Prix TTC / (1 + TVA%)
Cofinancement TTC = Prix HT × Pourcentage cofinancement
```

**Exemple concret** :
- Prix Uber TTC : 8,50 €
- TVA : 10%
- Prix HT : 8,50 / 1,10 = 7,727 €
- Cofinancement à 15% : 7,727 × 15% = **1,16 € TTC**

---

## Modifications à apporter

### 1. Récupérer le taux de TVA du produit

Les `menu_items` ont une colonne `vat_rate` (par défaut 10%). Le hook `useSimulatorRestaurantPrices` et le composant doivent avoir accès à cette donnée.

**Fichier** : `src/hooks/useSimulatorRestaurantPrices.ts`
- Ajouter `vat_rate` au type `EnrichedMenuItem`

**Fichier** : `src/components/menu/offers/BogoSimulator.tsx`
- Récupérer `vat_rate` depuis les `menuItems`

### 2. Corriger le calcul du cofinancement

**Fichier** : `src/components/menu/offers/BogoSimulator.tsx`

**Formule actuelle (lignes 287-290)** :
```typescript
const platformContribution = fundingType === "percent" 
  ? (foodCost * fundingValue / 100) 
  : fundingValue;
```

**Formule corrigée** :
```typescript
// Calcul du prix HT
const vatRate = selectedProduct.vat_rate ?? 10;
const priceHT = price / (1 + vatRate / 100);

// Le cofinancement est calculé sur le prix HT (résultat en TTC)
const platformContribution = fundingType === "percent" 
  ? (priceHT * fundingValue / 100) 
  : fundingValue;
```

### 3. Afficher le Prix HT dans la fiche produit

**Fichier** : `src/components/menu/offers/BogoSimulator.tsx`

Ajouter une ligne "Prix HT" dans la section d'affichage du produit sélectionné (après "Prix Uber") :

```tsx
{/* Affichage actuel */}
<div className="flex items-center justify-between">
  <span className="text-sm text-muted-foreground">Prix Uber</span>
  <span className="font-mono font-semibold text-orange-600">
    {selectedProduct.price_uber?.toFixed(2)}€
  </span>
</div>

{/* NOUVEAU: Prix HT */}
<div className="flex items-center justify-between">
  <span className="text-sm text-muted-foreground">Prix HT (TVA {vatRate}%)</span>
  <span className="font-mono">
    {priceHT.toFixed(2)}€
  </span>
</div>
```

### 4. Améliorer le message de contribution plateforme

Afficher le détail du calcul pour plus de transparence :

```tsx
{platformFunding && parseFloat(platformFunding) > 0 && simulation && (
  <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
    <Sparkles className="h-3.5 w-3.5" />
    <span>
      +{simulation.platformContribution?.toFixed(2)}€ de contribution plateforme
      <span className="text-emerald-500/70 ml-1">
        ({platformFunding}% du prix HT ≈ {priceHT.toFixed(2)}€)
      </span>
    </span>
  </div>
)}
```

---

## Modifications dans le multi-restaurant (restaurantResults)

Appliquer la même correction dans le calcul par restaurant (lignes 487-490) :

```typescript
// Pour chaque restaurant, récupérer le prix et calculer le cofinancement sur le HT
const vatRate = enrichedProduct.vat_rate ?? 10;
const priceHT = price / (1 + vatRate / 100);

const platformContribution = fundingType === "percent" 
  ? (priceHT * fundingValue / 100) 
  : fundingValue;
```

---

## Résumé des fichiers à modifier

| Fichier | Modifications |
|---------|---------------|
| `src/hooks/useSimulatorRestaurantPrices.ts` | Ajouter `vat_rate` à `EnrichedMenuItem` |
| `src/components/menu/offers/BogoSimulator.tsx` | 1. Corriger calcul cofinancement (2 endroits) 2. Ajouter affichage Prix HT 3. Améliorer message contribution |
| `src/components/menu/offers/CrossProductSimulator.tsx` | Mêmes corrections si cofinancement utilisé |
| `src/components/menu/offers/PercentDiscountSimulator.tsx` | Mêmes corrections si cofinancement utilisé |

---

## Résultat attendu

### Dans la fiche produit :
```
Prix Uber              8.50€ TTC
Prix HT (TVA 10%)      7.73€
Food Cost              2.01€
Ventes                 49
Catégorie              Burgers
```

### Message de contribution :
```
+1.16€ de contribution plateforme (15% du prix HT ≈ 7.73€)
```

### Calcul de marge corrigé :
Le cofinancement est désormais basé sur le prix HT, reflétant la réalité comptable d'Uber Eats.
