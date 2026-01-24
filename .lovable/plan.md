
# Plan : Améliorer le tooltip pour afficher le détail du calcul Net

## Problème

Le tooltip en mode "% Food Cost" + "Net" n'indique pas que la commission a été retirée pour calculer le ratio. L'utilisateur voit un pourcentage plus élevé sans comprendre pourquoi.

## Solution

Ajouter dans le tooltip (quand `marginType === "net"`) :
- **Commission HT** : Prix TTC × Taux% (ex: 7,90€ × 23,75% = 1,88€)
- **Revenu Net HT** : Prix HT - Commission (ex: 7,18€ - 1,88€ = 5,30€)
- Modifier le libellé final pour clarifier : "% Food Cost (Net)" au lieu de "% Food Cost"

## Modification

**Fichier** : `src/components/menu/ProfitabilityComparison.tsx`

**Lignes 970-982** - Tooltip du mode Food Cost :

```tsx
// AVANT
<TooltipContent>
  <div className="text-xs space-y-1">
    <div>Prix TTC: {price !== null ? `${price.toFixed(2)}€` : "—"}</div>
    {prixHT !== null && (
      <div>Prix HT: {prixHT.toFixed(2)}€ <span className="text-muted-foreground">(TVA {vatRate}%)</span></div>
    )}
    <div>Food Cost HT: {item.foodCost !== null ? `${item.foodCost.toFixed(2)}€` : "—"}</div>
    {fcPercent !== null && (
      <div className="border-t pt-1 mt-1">
        % Food Cost: {fcPercent.toFixed(1)}%
      </div>
    )}
  </div>
</TooltipContent>

// APRÈS
<TooltipContent>
  <div className="text-xs space-y-1">
    <div>Prix TTC: {price !== null ? `${price.toFixed(2)}€` : "—"}</div>
    {prixHT !== null && (
      <div>Prix HT: {prixHT.toFixed(2)}€ <span className="text-muted-foreground">(TVA {vatRate}%)</span></div>
    )}
    {marginType === "net" && price !== null && prixHT !== null && (
      <>
        <div>Commission: {(price * commissionRate / 100).toFixed(2)}€ <span className="text-muted-foreground">({commissionRate}%)</span></div>
        <div className="font-medium">Revenu Net HT: {(prixHT - price * commissionRate / 100).toFixed(2)}€</div>
      </>
    )}
    <div>Food Cost HT: {item.foodCost !== null ? `${item.foodCost.toFixed(2)}€` : "—"}</div>
    {fcPercent !== null && (
      <div className="border-t pt-1 mt-1 font-medium">
        % Food Cost {marginType === "net" ? "(Net)" : "(Brut)"}: {fcPercent.toFixed(1)}%
      </div>
    )}
  </div>
</TooltipContent>
```

## Résultat attendu

Le tooltip affichera pour Tower (7,90€ TTC, TVA 10%, Taux 23,75%) :

```text
Prix TTC: 7,90€
Prix HT: 7,18€ (TVA 10%)
Commission: 1,88€ (23,75%)
Revenu Net HT: 5,30€
Food Cost HT: 1,63€
─────────────────
% Food Cost (Net): 30,7%
```

Formule visible : **1,63 / 5,30 = 30,7%**

## Résumé

| Élément | Changement |
|---------|------------|
| Fichier | `src/components/menu/ProfitabilityComparison.tsx` |
| Lignes | 970-982 |
| Ajouts | Commission HT, Revenu Net HT, libellé "(Net)" ou "(Brut)" |
