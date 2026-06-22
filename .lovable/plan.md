## Contexte

Oui, la data est disponible : la table `orders` contient `meal_voucher_provider` + `meal_voucher_amount` au niveau de chaque commande. Sur l'ensemble du réseau on capte 6 émetteurs réels (Edenred, Swile, Sodexo, UpDéjeuner, Bimpli, Pluxee). On peut donc faire un vrai split par émetteur × restaurant × période.

Réponse à ta question : **oui, ton idée est la bonne**. Plutôt qu'une colonne unique "Titres Restaurant" dans le comparatif (qui cache les écarts d'émetteurs), on crée un onglet dédié dans le canal **Uber** avec une vue matricielle.

## Plan

### 1. Nouvel onglet "Titres Restaurant" dans la sidebar Uber

Dans `OverviewChannelSidebar.tsx`, ajouter sous Uber Eats une entrée enfant "Titres Restaurant" (icône Ticket / CreditCard). Nouveau channel `"uber-tr"`.

### 2. Hook `useMealVoucherBreakdown.ts`

RPC `get_meal_voucher_breakdown(chain_id, restaurant_ids[], date_from, date_to)` en `SECURITY DEFINER`, agrégation SQL en TZ Paris, qui renvoie par restaurant :
- Total TR (€) et nb commandes avec TR
- Split par émetteur : montant €, nb cmds, % du total TR du resto
- % des commandes Uber payées en TR
- Liste des émetteurs absents (sur les 6 connus)

Une seule RPC, agrégation Postgres (pas de pagination JS).

### 3. Page / panneau `MealVoucherAnalysisPanel.tsx`

Affiché quand `activeChannel === "uber-tr"` dans `Overview.tsx`.

**Bloc KPI réseau (haut)**
- Total TR encaissés (€) sur la période + % du CA Uber
- Nb cmds avec TR + panier moyen TR
- 6 mini-cartes par émetteur : montant, % part, nb restos actifs sur cet émetteur

**Tableau matriciel (corps)**
Une ligne par restaurant, colonnes :

```text
Restaurant | Total TR € | % CA Uber | Edenred | Swile | Sodexo | UpDéj | Bimpli | Pluxee | Émetteurs manquants
```

Chaque cellule émetteur = montant € + % (du total TR du resto). Cellule vide / grisée = émetteur jamais perçu sur la période → permet de repérer en un coup d'œil :
- Restos sans TR du tout (ex. Villeurbanne juin 2026)
- Restos qui n'ont que 2-3 émetteurs sur 6

Tri par colonne, recherche, sticky header (réutiliser le style de `RestaurantComparisonTable`).

**Drill-down (optionnel ligne)**
Clic sur une ligne → sheet latéral avec évolution mensuelle du TR par émetteur (bar chart empilé) pour ce restaurant.

### 4. Filtrage hors-scope

Ignorer les valeurs parasites issues du parsing CSV (`eats completed order`, `trip fare adjust order`) — whitelist sur les 6 émetteurs connus dans la RPC.

### 5. Périmètre

- Uber uniquement (Deliveroo / Caisse / Dishop n'ont pas la donnée TR par émetteur)
- Respecte `useActiveRestaurants()` + sentinel UUID
- Période pilotée par `OverviewPeriodSelector` existant

## Hors scope

- Pas de changement sur la colonne "Titre Restaurant" actuelle du comparatif (reste un total agrégé)
- Pas d'alerte automatique "émetteur manquant" (à voir dans un 2e temps)
- Pas d'export PDF dans ce premier jet
