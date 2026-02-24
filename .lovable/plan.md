

# Corriger l'affichage de la "Contribution marketing" Deliveroo

## Probleme

La commande 50554882242 affiche **-2,00€** en violet dans la colonne "Promos". C'est faux : la "Contribution marketing" Deliveroo est un **credit** versé par Deliveroo au restaurant (+2,00€ dans le CSV). Ce n'est pas une promo déduite du restaurant comme sur Uber Eats.

```text
Données en base pour la commande 50554882242 :
  Livraison      : order_amount=8.10, commission=-1.94, total_payable=5.77
  Contrib. mktg  : order_amount=0,    commission=0,     total_payable=+2.00  ← CREDIT

Affichage actuel (faux) :  Promos = -2,00€ (violet, comme une déduction)
Affichage correct :        Contrib. Deliveroo = +2,00€ (vert, c'est un crédit)
```

## Modifications

### Fichier 1 : `src/components/analytics/OrdersAnalysisSection.tsx`

**Onglet "Par Commande"** — Adapter la colonne "Promos" selon la plateforme :

- Quand `platform === "deliveroo"` : renommer l'en-tete en **"Contrib. Mktg"** et afficher la valeur en **vert avec un signe +** (c'est un crédit)
- Quand `platform === "uber_eats"` : garder "Promos" en violet avec un signe − (c'est une déduction)
- Quand `platform === "global"` : garder "Promos" (comportement mixte)

Meme logique pour les onglets "Par Jour" et les totaux.

### Fichier 2 : `src/hooks/useFinancesDrilldown.ts`

Aucun changement dans le hook — la valeur `item_promo_incl_vat = 2.00` (absolue positive) est correcte. Seul l'affichage change.

## Detail technique

Dans `OrdersAnalysisSection.tsx`, 3 endroits à modifier :

1. **En-tete de colonne** (ligne ~867) : `platform === "deliveroo" ? "Contrib. Mktg" : "Promos"`
2. **Cellule par commande** (ligne ~947-948) : 
   - Deliveroo : `+2,00€` en `text-green-600`
   - Uber : `-2,00€` en `text-purple-600`
3. **Ligne totaux "Par Jour"** (lignes ~586, ~548) : meme logique de signe et couleur

## Resultat attendu

| Colonne | Uber Eats | Deliveroo |
|---------|-----------|-----------|
| En-tete | Promos | Contrib. Mktg |
| Valeur | -2,00€ (violet) | +2,00€ (vert) |
| Signification | Déduction du CA | Crédit Deliveroo |

Les montants de Versement et Rentabilité restent inchangés (déjà corrects).

