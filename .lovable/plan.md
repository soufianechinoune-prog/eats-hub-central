

# Ajouter les 2 types Deliveroo 2024 manquants dans l'agregation client

## Contexte

Sur les 5 types mentionnes, 3 sont deja geres (A emporter, Bon de reduction, Eco-contribution). Les 2 manquants tombent dans le `else` generique avec `Math.abs()` ce qui peut inverser leur signe dans les KPIs.

## Changements

### 1. `src/pages/Analytics.tsx` (ligne ~335 et ~1021)

- Ajouter `"Publicités Marketer"` dans `PROMO_TYPES` (c'est une depense marketing facturee, meme logique que "Contribution marketing")
- Creer `CREDIT_ADJUSTMENT_TYPES = ["Crédit pour rectification de facture"]` et les ajouter au `net_payout` sans `Math.abs()` (credit = positif)

### 2. `src/hooks/useFinancesDrilldown.ts` (ligne ~20-30)

- Ajouter `"Publicités Marketer"` dans `DELIVEROO_PROMO_TYPES`
- Creer une categorie pour "Credit pour rectification de facture" avec la meme logique (ajout au net sans inversion de signe)

### 3 fichiers modifies, 4 points d'edition

Chaque point = ajouter 1-2 lignes dans une liste existante ou creer un petit bloc `else if` de 3 lignes.

