## Diagnostic des taux 26,7 % et 26,6 %

Le calcul actuel **est correct** — il vérifie bien la commission appliquée. La différence avec 27 % vient simplement du **mélange livraison / à emporter** dans le dénominateur.

### Vérification chiffrée (Reims, données réelles)

**5 février 2026**
| Canal | Cmd | Base TTC (CA−promo) | Commission HT | Taux |
|---|---|---|---|---|
| Livraison | 93 | 1 872,41 € | 505,68 € | **27,01 %** ✅ |
| À emporter | 2 | 43,90 € | 6,59 € | **15,01 %** ✅ |
| **Total** | **95** | **1 916,31 €** | **512,27 €** | **26,73 %** |

→ Uber applique bien les bons taux contractuels. Le 26,7 % global est juste la moyenne pondérée par la base TTC.

**25 février 2026**
| Canal | Cmd | Base TTC | Commission HT | Taux |
|---|---|---|---|---|
| Livraison | 61 | 1 310,84 € | 353,96 € | **27,00 %** ✅ |
| À emporter | 2 | 41,10 € | 6,17 € | **15,01 %** ✅ |
| **Total** | **63** | **1 351,94 €** | **360,13 €** | **26,64 %** |

→ Pareil, taux contractuels respectés. Le poids un peu plus faible de la livraison fait descendre la moyenne à 26,6 %.

### Pourquoi votre estimation 26,9 % donne 26,7 %

La moyenne pondérée se fait sur la **base TTC**, pas sur le nombre de commandes :
- Si on pondère par commandes : 93/95×27 + 2/95×15 = **26,75 %**
- Si on pondère par base TTC : 1872/1916×27 + 44/1916×15 = **26,73 %**

Les deux donnent ~26,7 %, pas 26,9 %. Le calcul est mathématiquement sain.

### Proposition : rendre l'audit visible

Le chiffre global cache la décomposition. Pour vraiment **vérifier** que Uber applique 27 % et 15 %, on ajoute une décomposition par type de service dans la cellule Commission.

#### Option A — Tooltip enrichi (léger)
Au survol de la cellule Commission d'une ligne, on affiche :
```
Commission Uber
─────────────────────────
🚲 Livraison    93 cmd   27,01 %   505,68 € HT
🛍️ À emporter    2 cmd   15,01 %     6,59 € HT
─────────────────────────
Moyenne pondérée         26,73 %
✅ Taux contractuels respectés
```

Un badge ⚠️ apparaît si l'écart vs 27 % / 15 % dépasse 0,5 pt (signal anomalie facturation).

#### Option B — Sous-ligne dépliable (plus visible)
Au clic sur la ligne, on ajoute deux sous-lignes au-dessus du drilldown actuel : une Livraison, une À emporter, chacune avec son taux. Permet de scanner visuellement plusieurs jours.

#### Option C — Les deux
Tooltip pour scan rapide + sous-lignes dans le drilldown détaillé.

### Détails techniques

- Source : table `orders`, groupé par `fulfillment_type` (déjà disponible côté DB).
- Calcul par canal : `SUM(uber_fee_before_promo_excl_vat) / (SUM(sales_incl_vat) − SUM(item_promo_incl_vat))`.
- Seuil d'alerte : écart absolu > 0,5 pt vs 27 % (livraison) ou 15 % (emporté).
- Fichiers à modifier :
  - `src/components/analytics/ProfitabilityComparisonTable.tsx` — ajout du calcul par fulfillment_type et UI tooltip/sous-ligne.
  - `src/hooks/useFinancesDrilldown.ts` — exposer le breakdown par canal si Option B/C.

**Question pour valider :** Option A (tooltip), B (sous-lignes) ou C (les deux) ?
