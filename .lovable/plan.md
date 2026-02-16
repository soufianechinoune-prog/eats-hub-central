
# Vue mensuelle avec accordeon depliable

## Objectif

Transformer la vue "Mois" du tableau de rentabilite pour qu'elle fonctionne en mode accordeon :
- Par defaut : seules les lignes de synthese mensuelle sont visibles (Janvier, Fevrier, Mars...) + ligne Total
- Clic sur une fleche : deroule la liste des restaurants de ce mois
- Cela permet d'avoir une vue d'ensemble annuelle claire, puis de zoomer sur un mois specifique

## Comportement

```text
+------------------------------------------------------------------+
| Restaurant      | CA TTC  | Rentab. | Commission | ... | Total   |
+------------------------------------------------------------------+
| > Fevrier 2026  | 585 931 | 56.0%   | 26.9%      | ... | 327 962 |
| > Janvier 2026  | 3 153 k | 55.1%   | 27.1%      | ... | 1 738 k |
|   (clic sur >)                                                    |
|   CS Toulouse   | 29 286  | 67.3%   | 26.9%      | ... | 19 720  |
|   CS Arras      | 18 322  | 63.9%   | 26.9%      | ... | 11 701  |
|   ...           |         |         |            |     |         |
|   Ecart         |         | +X pts  |            |     |         |
| Total 2026      | ...     | 56.5%   |            | ... | ...     |
+------------------------------------------------------------------+
```

- Fleche ChevronRight (>) quand replie, ChevronDown (v) quand deplie
- Par defaut, tous les mois sont replies
- Cliquer sur la fleche deroule/replie les restaurants de ce mois
- Le bouton "Detail" (loupe) reste present pour ouvrir le panneau lateral

## Modification technique

**Fichier unique** : `src/components/analytics/ProfitabilityComparisonTable.tsx`

1. Ajouter un state `expandedMonths` (Set de monthKey) pour tracker les mois depliés
2. Ajouter un bouton chevron dans la cellule du mois (colonne Restaurant)
3. Conditionner l'affichage des lignes restaurant : visible uniquement si le mois est dans `expandedMonths`
4. La ligne "Ecart" suit la meme logique (visible quand deplie)
5. La ligne "Total" en bas reste toujours visible

Pas de changement de base de donnees, pas de nouveau fichier. Modification purement UI dans le rendu du `viewMode === 'month'`.
