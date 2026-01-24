
# Plan : Corriger le calcul de la commission (TTC au lieu de HT)

## Problème confirmé

Le code actuel calcule la commission sur le **Prix HT**, alors qu'Uber (et Deliveroo) calculent sur le **Prix TTC**.

**Exemple avec 100€ TTC, TVA 10%, Taux 27% :**
| Calcul | Actuel (incorrect) | Correct |
|--------|-------------------|---------|
| Commission | 91 × 27% = 24,57€ | 100 × 27% = 27€ |
| Revenu Net | 91 - 24,57 = 66,43€ | 91 - 27 = 64€ |

---

## Modifications

### 1. `src/hooks/useRestaurantProfitability.ts`

**Ligne 146** - Uber :
```typescript
// AVANT
const commission = prixHT * (commissionRate / 100);

// APRÈS
const commissionHT = prices.priceUber * (commissionRate / 100);
```

**Ligne 157** - Deliveroo :
```typescript
// AVANT
const commission = prixHT * (commissionRate / 100);

// APRÈS
const commissionHT = prices.priceDeliveroo * (commissionRate / 100);
```

### 2. `src/components/menu/ProfitabilityComparison.tsx`

**Ligne 179** :
```typescript
// AVANT
const commissionAmount = prixHT * (commissionRate / 100);

// APRÈS
const commissionHT = price * (commissionRate / 100); // price est TTC
```

---

## Vérification avec Tower (7,90€ TTC)

| Élément | Avant (bug) | Après (corrigé) |
|---------|-------------|-----------------|
| Prix HT (TVA 10%) | 7,18€ | 7,18€ |
| Commission (23,75%) | 7,18 × 23,75% = 1,70€ | 7,90 × 23,75% = **1,88€** |
| Revenu Net | 7,18 - 1,70 = 5,48€ | 7,18 - 1,88 = **5,30€** |
| FC % Net (FC=1,63€) | 1,63 / 5,48 = 29,7% | 1,63 / 5,30 = **30,7%** |

Le FC % Net augmente d'environ **1 point**, reflétant la réalité comptable.

---

## Résumé

- **2 fichiers** à modifier
- **3 lignes** de code à corriger
- Formule : `Commission HT = Prix TTC × Taux Contrat`
