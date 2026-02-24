

# Corriger l'agregation Deliveroo : exclure les reports de facture precedente

## Contexte

Le document de reconciliation fourni par l'utilisateur prouve que les lignes "Facture precedente" du CSV sont des reports informatifs de la semaine precedente. Elles ne doivent PAS etre ajoutees au total de la semaine courante.

Le code actuel (apres le dernier correctif) inclut ces lignes dans ORDER_TYPES et REFUND_TYPES, ce qui fausse le CA et les remboursements.

## Chiffres de reference (reconciliation validee)

```text
CA brut TTC (383 livraisons)     :  6 356,75 EUR
Commission HT (24%)             : -1 525,16 EUR
TVA commission                   :   -305,52 EUR
Titres-restaurant (65 lignes)    :   -966,90 EUR
Remboursements clients (5)       :    -26,60 EUR
Commission repreparation HT      :     -2,78 EUR
TVA commission repreparation     :     -0,56 EUR
Contribution marketing (262)     :   +614,00 EUR
Repreparation commande (1)       :    +11,60 EUR
Remb. client refuse (1, sem.)    :     +4,50 EUR
----------------------------------------------
TOTAL A PERCEVOIR (sem. courante):  4 197,42 EUR

Reports facture precedente (informatif, hors total) :
  Facture prec. Livraison        :    +32,83 EUR
  Facture prec. Remboursement    :    -38,09 EUR
  Net reports                    :     -5,26 EUR
```

## Modifications

### Fichier : `src/pages/Analytics.tsx`

#### 1. Retirer les types "Facture precedente" des listes ORDER_TYPES et REFUND_TYPES

```text
Avant :
  ORDER_TYPES = ["Livraison", "A emporter", "Nouvelle livraison",
                 "Facture precedente: Livraison",
                 "Montant de la repreparation de commande"]
  REFUND_TYPES = ["Remboursement client",
                  "Remboursement client refuse",
                  "Facture precedente: Remboursement client"]

Apres :
  ORDER_TYPES = ["Livraison", "A emporter", "Nouvelle livraison",
                 "Montant de la repreparation de commande"]
  REFUND_TYPES = ["Remboursement client"]
```

#### 2. Creer une liste POSITIVE_ADJUSTMENT_TYPES pour les montants positifs recuperes

Les "Remboursement client refuse" sont des montants POSITIFS (argent recupere par le restaurant). Ils ne sont pas des remboursements a deduire mais des ajouts au versement.

```text
POSITIVE_ADJUSTMENT_TYPES = ["Remboursement client refuse"]
```

Dans le bloc d'agregation :
```text
} else if (POSITIVE_ADJUSTMENT_TYPES.includes(ht)) {
  g.net_payout += Number(row.total_payable) || 0;  // positif, ajoute au versement
  g.other_payments_incl_vat += Number(row.total_payable) || 0;  // tracking
}
```

#### 3. Creer une liste PREVIOUS_INVOICE_TYPES pour ignorer les reports

Ces lignes ne doivent pas impacter les totaux de la semaine courante. Elles sont deja comptabilisees dans la semaine precedente.

```text
PREVIOUS_INVOICE_TYPES = ["Facture precedente: Livraison",
                          "Facture precedente: Remboursement client"]
```

Dans le bloc d'agregation :
```text
} else if (PREVIOUS_INVOICE_TYPES.includes(ht)) {
  // Reports de facture precedente : ignores pour le total semaine courante
  // On peut optionnellement les tracker dans un champ separe pour info
  continue;
}
```

### Resultat attendu apres correction (semaine du 19 janvier)

```text
CA TTC         : 6 356,75 EUR (sans facture precedente)
Commission TTC : 1 833,46 EUR (1 830,68 standard + 2,78 repreparation)
Promos         :   614,00 EUR (contributions marketing)
Remb.          :    26,60 EUR (5 remboursements clients)
Titre Resto    :   966,90 EUR (positif pour affichage)
Versement Del. : 4 197,42 EUR (ce que Deliveroo transfere reellement)
Versement Tot. : 5 164,32 EUR (Deliveroo + Titres restaurant)
Rentabilite    : ~81,3% (versement total / CA)
```

Ces chiffres correspondent exactement au document de reconciliation valide par l'utilisateur.

