

# Corriger l'affichage de la Commission Deliveroo dans le tableau de Rentabilite

## Diagnostic

Les donnees de commission existent bien dans la base de donnees (`commission_amount = -3.42` pour une commande de 14.24 EUR, soit 24%). Le probleme vient du calcul du taux dans le tableau :

- Pour Uber, le taux est calcule via `uber_fee_after_promo_excl_vat` (commission HT), un champ specifique aux donnees Uber
- Pour Deliveroo, ce champ n'existe pas dans les donnees mappees. Seul `uber_fee_after_promo_incl_vat` (commission TTC) est rempli
- Resultat : le taux affiche est `0 / CA = 0%`

## Correction

Dans `ProfitabilityComparisonTable.tsx`, ajouter un fallback : quand `uber_fee_after_promo_excl_vat` n'est pas disponible (cas Deliveroo), utiliser `uber_fee_after_promo_incl_vat` directement pour calculer le taux de commission.

La commission Deliveroo est deja un montant HT dans les releves (24% HT applique sur le CA TTC), donc utiliser la valeur TTC telle quelle est correct.

### Fichier modifie : `src/components/analytics/ProfitabilityComparisonTable.tsx`

Ligne 306 : remplacer le calcul du taux de commission pour gerer le cas ou `excl_vat` est absent :

```typescript
// Avant
const uberFeeHT = Math.abs(Number(payout.uber_fee_after_promo_excl_vat) || 0);

// Apres
const uberFeeHT = Math.abs(Number(payout.uber_fee_after_promo_excl_vat) || 0)
  || Math.abs(Number(payout.uber_fee_after_promo_incl_vat) || 0);
```

Cela garantit que si le champ HT specifique Uber n'est pas present, on utilise le montant de commission disponible (qui pour Deliveroo represente deja le bon montant).

### Fichier modifie : `src/pages/Analytics.tsx`

Dans la requete `deliverooPayoutsData`, ajouter le champ `uber_fee_after_promo_excl_vat` au mapping pour plus de coherence. Puisque Deliveroo fournit une commission sans decomposition HT/TTC, on peut dupliquer la valeur :

```typescript
// Dans le grouped initializer
uber_fee_after_promo_excl_vat: 0,

// Dans le bloc ORDER_TYPES
g.uber_fee_after_promo_excl_vat += Math.abs(Number(row.commission_amount) || 0);
```

Cela alimentera directement le champ attendu par le tableau sans necessiter de fallback.

## Resultat attendu

La colonne "Commission" affichera ~24% pour les semaines Deliveroo au lieu de 0.0%.

