

# Corriger le montant de la commission Deliveroo : 1 529 → 1 525,16

## Probleme identifie

La commission affichee est gonflée par la "Commission Deliveroo sur repreparation de commande" (3,34€) qui est ajoutée aux champs `uber_fee_after_promo_excl_vat` et `uber_fee_after_promo_incl_vat`.

```text
Donnees en base (semaine 19 janv.) :
  Livraison : commission_amount = -1 525,16€  ← LA VRAIE COMMISSION
  Commission sur repreparation  = -3,34€      ← FRAIS SUPPLEMENTAIRE

Calcul actuel (faux) :
  Commission affichee = 1 525,16 + 3,34 = 1 528,50€
  Taux = 1 528,50 / 6 356,75 = 24,05%

Calcul correct :
  Commission affichee = 1 525,16€
  Taux = 1 525,16 / 6 356,75 = 24,0%
```

## Modification

### Fichier : `src/pages/Analytics.tsx` (lignes 446-449)

Retirer l'ajout de la "Commission Deliveroo sur repreparation" aux champs commission. Ce montant est un frais supplementaire, pas la commission contractuelle. Il doit uniquement impacter le `net_payout` et etre classe dans `other_payments_incl_vat` (comme les "Debit : frais supplementaires" du releve PDF).

```text
Avant (lignes 446-449) :
  } else if (EXTRA_COMMISSION_TYPES.includes(ht)) {
    g.uber_fee_after_promo_incl_vat += Math.abs(Number(row.total_payable) || 0);
    g.uber_fee_after_promo_excl_vat += Math.abs(Number(row.total_payable) || 0);
    g.net_payout += Number(row.total_payable) || 0;

Apres :
  } else if (EXTRA_COMMISSION_TYPES.includes(ht)) {
    // Frais supplementaires (repreparation) : pas dans la commission contractuelle
    g.other_payments_incl_vat += Math.abs(Number(row.total_payable) || 0);
    g.net_payout += Number(row.total_payable) || 0;
```

## Resultat attendu

| Metrique | Avant | Apres |
|----------|-------|-------|
| Commission | 1 529€ | 1 525,16€ |
| Taux | ~24,05% | 24,0% |
| Versement | Inchange | Inchange |

Le versement total reste identique (4 197,42€) car le `net_payout` n'est pas modifie. Seul le classement du montant change : de "commission" vers "frais supplementaires".

