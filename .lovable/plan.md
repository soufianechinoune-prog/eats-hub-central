
# Corriger les calculs financiers Deliveroo

## Bugs identifies

### Bug 1 : Versement Deliveroo et Total incorrects (ecart +1000 EUR/semaine)
Les lignes "titre restaurant" (Edenred, Swile, etc.) ont un `total_payable` negatif dans `deliveroo_orders` (c'est une deduction du versement Deliveroo). Or le code actuel :
- N'ajoute PAS ce `total_payable` negatif dans `net_payout`
- Stocke `meal_voucher_amount` en negatif
- Le tableau applique `Math.abs()` sur `meal_voucher_amount`, le rendant positif
- Resultat : `totalToReceive = 5194 + 967 = 6161` au lieu de `4227 + 967 = 5194`

**Correction** : Dans l'agregation Deliveroo, pour les MEAL_VOUCHER_TYPES :
- Stocker `meal_voucher_amount` en positif (Math.abs)
- Ajouter `total_payable` (negatif) dans `net_payout` pour refleter la deduction

### Bug 2 : Types d'historique manquants dans les listes de classification
Certains `history_type` Deliveroo tombent dans le bucket "other" alors qu'ils devraient etre classes :

**ORDER_TYPES** - ajouter :
- "Facture precedente: Livraison" (CA et commission de la semaine precedente, 56.80 EUR manquants)

**REFUND_TYPES** - ajouter :
- "Remboursement client refuse" (contestation refusee = argent recupere)
- "Facture precedente: Remboursement client"

**Types a gerer specifiquement** :
- "Commission Deliveroo sur repreparation de commande" : commission supplementaire
- "Montant de la repreparation de commande" : order supplementaire

### Bug 3 : Remboursements affiches a 0
Le code utilise `Math.abs(Number(row.order_amount))` pour les remboursements, mais `order_amount` est 0 pour les lignes "Remboursement client". Le montant est dans `total_payable`. Il faut utiliser `Math.abs(total_payable)` a la place.

### Bug 4 : Rentabilite fausse (96.9% au lieu de ~81.7%)
Consequence directe des bugs 1 et 2. La formule `totalToReceive / CA` donne un resultat gonfle car `totalToReceive` est trop eleve.

## Plan de modifications

### Fichier : `src/pages/Analytics.tsx` (agregation Deliveroo)

1. Etendre les listes de types :

```text
ORDER_TYPES += "Facture precedente: Livraison",
               "Montant de la repreparation de commande"

REFUND_TYPES += "Remboursement client refuse",
                "Facture precedente: Remboursement client"
```

2. Corriger le bloc MEAL_VOUCHER_TYPES :

```text
Avant :
  g.meal_voucher_amount += Number(row.total_payable)     // negatif

Apres :
  g.meal_voucher_amount += Math.abs(Number(row.total_payable))  // positif
  g.net_payout += Number(row.total_payable)                      // deduction
```

3. Corriger le bloc REFUND_TYPES :

```text
Avant :
  g.refund_incl_vat += Math.abs(Number(row.order_amount))  // = 0

Apres :
  g.refund_incl_vat += Math.abs(Number(row.total_payable))  // montant reel
```

4. Ajouter un type "Commission supplementaire" pour "Commission Deliveroo sur repreparation" :

```text
g.uber_fee_after_promo_incl_vat += Math.abs(Number(row.total_payable))
g.uber_fee_after_promo_excl_vat += Math.abs(Number(row.total_payable))
g.net_payout += Number(row.total_payable)
```

### Resultat attendu apres correction (semaine du 19 janvier)

```text
CA TTC        : 6 413 EUR (inclut facture precedente)
Commission    : 1 542 EUR (inclut commission repreparation)
Promos        : 614 EUR
Remb.         : 26 EUR (montant reel des remboursements)
Titre Resto   : 967 EUR
Versement Del.: 4 227 EUR (ce que Deliveroo transfere reellement)
Versement Tot.: 5 194 EUR (Deliveroo + Titres restaurant)
Rentabilite   : ~81% (ratio reel)
```
