

# Fix : stats Livraison/Emporté sur la totalité des commandes

## Problème

Les badges KPI "Livraison : 198 (99%)" et "Emporté : 2 (1%)" sont calculés sur `orderData`, qui ne contient que les commandes chargées (200 sur 2783). Les chiffres sont donc faux et changent au fur et à mesure du scroll.

## Solution

Créer une requête SQL dédiée qui calcule les stats de fulfillment sur **toutes** les commandes de la période, indépendamment de la pagination.

## Modifications

### 1. `src/hooks/useFinancesDrilldown.ts`

Ajouter une **nouvelle query** `useQuery` dédiée aux stats fulfillment :
- Requête : `SELECT fulfillment_type, COUNT(*), SUM(sales_incl_vat)` groupée par `fulfillment_type`, filtrée par dates/restaurants/platform
- Retournée via un nouveau champ `fulfillmentStats` dans le retour du hook
- `enabled` uniquement quand `granularity === "order"`
- Pas de limit/pagination — c'est un agrégat léger

### 2. `src/components/analytics/OrdersAnalysisSection.tsx`

- Supprimer le `useMemo` `fulfillmentStats` calculé côté client sur `orderData`
- Utiliser directement le `fulfillmentStats` retourné par le hook (données complètes serveur)
- Appliquer le filtre fulfillment **côté serveur** aussi : ajouter `fulfillmentFilter` comme paramètre du hook pour filtrer la requête principale des commandes

### 3. Filtre côté serveur

Actuellement le filtre Livraison/Emporté est appliqué côté client dans `filteredOrderData`. Le déplacer côté serveur dans `fetchUberIndividualOrders` :
- Si `fulfillmentFilter === "delivery"` → `.ilike("fulfillment_type", "%Livraison%")` ou `.ilike("fulfillment_type", "%Delivery%")`
- Si `fulfillmentFilter === "pickup"` → `.ilike("fulfillment_type", "%emporter%")` ou `.ilike("fulfillment_type", "%Pickup%")`

Cela garantit que la pagination (200 affichées / total) est correcte par rapport au filtre.

## Résultat

- Les badges affichent les vrais totaux sur toutes les commandes de la période
- Le filtre Livraison/Emporté fonctionne côté serveur — plus besoin de charger toute la data
- Le compteur "X / Y commandes" reflète le filtre appliqué

