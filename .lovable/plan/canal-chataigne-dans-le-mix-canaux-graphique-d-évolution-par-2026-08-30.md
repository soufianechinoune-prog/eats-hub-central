# Canal Chataigne dans le Mix Canaux + graphique d'évolution par canal

## Objectif

Sur le tableau « Comparatif des restaurants » (Overview), quand on déplie un restaurant :
1. Ajouter la vignette **Chataigne** à côté de Uber Eats et Caisse (et Deliveroo si présent).
2. Ajouter un graphique quotidien montrant, sur la période sélectionnée, le CA de chaque canal jour par jour et la part de chacun dans le CA total du point de vente.

## 1. Vignette Chataigne

- Nouveau canal `chataigne` dans le référentiel des canaux (label « Chataigne », icône MessageCircle, couleur dédiée verte WhatsApp), utilisé partout : barre empilée « MIX CANAUX », pastilles à côté du nom du restaurant, et carte détaillée.
- La carte Chataigne affiche CA, Commandes, Panier moyen (données brutes, pas d'ops : ni note, ni erreurs, ni délais — non disponibles sur ce canal).
- Le CA Chataigne entre dans le total du restaurant pour le calcul des parts (%) : le mix passe de « Uber 26% / Caisse 74% » à un mix à 3 canaux.
- Les données viennent de l'agrégat Chataigne par restaurant déjà en place, chargé sur la période sélectionnée uniquement pour Chicken Street (le canal disparaît naturellement si le CA est à 0).

## 2. Graphique « Évolution par canal » (vue jour)

Nouveau bloc sous les vignettes, dans le panneau déplié du restaurant :

- **Graphique principal** : aires empilées par jour (Uber Eats, Deliveroo, Caisse, Chataigne) → on voit à la fois le CA total quotidien et la composition.
- **Bascule 2 modes** :
  - « € » : CA empilé en euros ;
  - « % » : empilement à 100 % pour lire la part de chaque canal jour par jour.
- **Légende interactive** : clic pour masquer/afficher un canal.
- **Tooltip** : par jour, CA de chaque canal + total + part en %.
- **Bandeau récap** au-dessus : une pastille par canal avec CA total sur la période et part en % (couleurs cohérentes avec la barre de mix).
- États gérés : chargement (skeleton), aucune donnée sur la période.

Le chargement des données est déclenché uniquement à l'ouverture du panneau du restaurant (lazy), pour ne pas alourdir la page.

## Détails techniques

- `src/components/overview/ChannelBreakdownPanel.tsx` : ajout de `chataigne` dans `CHANNEL_META` / `ChannelId`, prop `chataigne?: { revenue; orders; avgBasket }`, ajout de la carte et inclusion dans le total.
- `src/components/overview/RestaurantComparisonTable.tsx` : nouvelle prop `chataigneByRestaurant?: Map<string, {...}>`, prise en compte dans les segments de `ChannelMixBar`, les `ChannelChips` et le passage au panneau.
- `src/pages/Overview.tsx` : chargement de l'agrégat Chataigne par restaurant sur la période (RPC `get_chataigne_by_restaurant`, déjà existante) et transmission au tableau.
- Nouveau `src/components/overview/ChannelDailyRevenueChart.tsx` : recharts `AreaChart` empilé, sources par jour pour un restaurant :
  - Uber : `get_daily_revenue_from_orders`
  - Caisse : `get_daily_onsite_from_splash`
  - Chataigne : `get_daily_chataigne`
  - Deliveroo : agrégation quotidienne depuis `deliveroo_orders` (à confirmer à l'implémentation ; si aucune source fiable par jour, le canal est simplement absent du graphique et une note l'indique).
  Fusion des séries par date côté client, requêtes en parallèle via React Query, clés scopées restaurant + période.
- Couleurs via tokens CSS existants (`--uber`, `--deliveroo`, `--cash`) + token Chataigne aligné sur la couleur déjà utilisée pour le canal WhatsApp.

## Hors périmètre

- Aucun changement des calculs financiers existants (versement, rentabilité, % pub restent Uber).
- Pas de colonne Chataigne dédiée dans le tableau principal ni d'onglet canal Chataigne (peut être ajouté ensuite si utile).
