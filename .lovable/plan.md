# Problème confirmé

Tu as raison. Le bandeau **Dishop en haut** (34 290 €, 1 487 cmds, 91.6% rentab) lit bien `dishop_orders` via `useDishopOverview` → ✅ ces chiffres sont les vrais Dishop.

En revanche, le tableau **Comparatif des restaurants** en dessous est branché en dur sur les données **tous canaux confondus** quand on est sur Dishop. Dans `src/pages/Overview.tsx` ligne 1013 :

```ts
forcedChannel={activeChannel === "global" || activeChannel === "dishop" ? "all" : activeChannel}
```

Donc en cliquant sur "Dishop" dans la sidebar, le tableau retombe sur `"all"` → CA, versement, commandes, panier, note, erreurs, dispo affichés = **agrégat Uber + Caisse** (essentiellement Uber). C'est pour ça que Argenteuil sort à 12 885 € / 635 cmds : c'est Uber, pas Dishop.

# Plan

Construire un **tableau comparatif dédié Dishop** affiché uniquement quand `activeChannel === "dishop"`, en remplacement de `RestaurantComparisonTable` dans ce mode.

## Colonnes Dishop (par restaurant)

| # | Restaurant | CA TTC | Cmds | Panier | Commission € (%) | Rentabilité | % Promo |

Pas de Versement / Note / Erreurs / Dispo / Prépa+Livr (pas applicable Dishop).

## Implémentation

1. **Nouveau hook** `src/hooks/useDishopRestaurantBreakdown.ts`
   - Mêmes paramètres que `useDishopOverview` (chainId, restaurantIds, période).
   - Query `dishop_orders` paginée (PAGE=1000), `select restaurant_id, total_ttc, commission_*, promo_*, ...` filtré par `chain_id` + `restaurant_id IN (...)` + fenêtre dates.
   - Agrège en JS par `restaurant_id` : caTTC, orderCount, averageBasket, commissionAmount, commissionRate, profitability, promoShare.
   - Joint le `name` via la liste `restaurants` déjà disponible dans `Overview.tsx`.
   - `staleTime: 5min`.

2. **Nouveau composant** `src/components/overview/DishopRestaurantComparisonTable.tsx`
   - Reprend l'esthétique de `RestaurantComparisonTable` (header sticky, ligne `LIVE`, tri, recherche) mais avec uniquement les 6 colonnes Dishop ci-dessus.
   - Tri par CA TTC desc par défaut.
   - Pas d'expansion par plateforme (single source = Dishop).

3. **Overview.tsx**
   - Ligne ~997 : remplacer par un rendu conditionnel
     ```tsx
     {activeChannel === "dishop" ? (
       <DishopRestaurantComparisonTable ... />
     ) : (
       <RestaurantComparisonTable ... forcedChannel={activeChannel === "global" ? "all" : activeChannel} />
     )}
     ```
   - Retirer `"dishop"` du fallback `forcedChannel`.

## Hors scope

- Pas de modification du bandeau KPI Dishop (déjà correct).
- Pas de modification du comportement Global / Uber / Caisse / Deliveroo.
- Pas de Versement/Note/Dispo pour Dishop (data non disponible côté Dishop).
