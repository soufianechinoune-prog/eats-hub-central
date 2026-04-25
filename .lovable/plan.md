## Diagnostic

La data n'est pas perdue.

Côté base, Chicken Street a bien **101 restaurants actifs**. Le bug vient du frontend : dans `useOverviewData.ts`, la requête interne des restaurants contient encore :

```ts
.eq("is_pinned", true)
```

Même quand le toggle est sur **Réseau**, le hook intersecte ensuite les 101 IDs réseau avec cette liste d'épinglés. Comme il n'y a plus d'épinglés, l'intersection donne 0 restaurants → dashboard vide.

## Priorité 1 — Correctif immédiat dashboard

Corriger `src/hooks/useOverviewData.ts` :
- Supprimer le filtre `eq("is_pinned", true)`.
- Charger tous les restaurants actifs de la marque.
- Renommer/commenter la logique : ce hook ne doit plus être "pinned-first".

Résultat : la Vue d'ensemble repasse immédiatement à **101 restaurants actifs** en mode réseau.

## Priorité 2 — Suppression du système Épinglés/Réseau côté UI

Conformément à ta décision :
- Supprimer le toggle **Épinglés / Réseau** partout.
- Supprimer le bouton étoile pin/unpin sur la page Restaurants.
- Garder la colonne `is_pinned` en base pour réversibilité, mais ne plus l'utiliser dans l'UI.

## Comportement cible

| Écran | Après |
|---|---|
| Vue d'ensemble | Tous les restaurants actifs de la marque, plus de toggle |
| Analytics | Tous les actifs sélectionnés par défaut, filtre manuel possible |
| Pages comparatives | Tout le réseau actif par défaut |
| Restaurants | Plus d'étoile pin/unpin, tri alphabétique |
| Reporting WhatsApp | Tous les restaurants actifs pré-cochés |
| Dialog "Sauvegarder en action" | Aucun restaurant pré-coché |
| Sélecteurs menu/simulateur | Liste unifiée alphabétique, plus de séparation épinglés/non-épinglés |

## Fichiers principaux à modifier

### Vue d'ensemble
- `src/pages/Overview.tsx`
  - Retirer `NetworkViewToggle`.
  - Retirer `isNetworkView`, `pinnedRestaurants`, `pinnedIds`.
  - Utiliser directement `allActiveRestaurants.map(r => r.id)`.
  - Compteur = restaurants actifs.
- `src/hooks/useOverviewData.ts`
  - Retirer le filtre caché `is_pinned=true`.

### Contexte Analytics
- `src/contexts/AnalyticsContext.tsx`
  - Retirer `isNetworkView` / `setIsNetworkView` du contexte et du localStorage.
- `src/components/layout/AppSidebar.tsx`
  - Retirer `setIsNetworkView(true)` lors du changement de marque.

### Pages comparatives
- `src/pages/RatingsComparison.tsx`
- `src/pages/DowntimeComparison.tsx`
- `src/pages/PrepTimeComparison.tsx`
- `src/pages/TotalDeliveryTimeComparison.tsx`
- `src/pages/InaccurateOrdersComparison.tsx`

Pour chacune : remplacer la logique `isNetworkView ? allActiveRestaurants : pinnedRestaurants` par `allActiveRestaurants`, puis retirer le toggle.

### Analytics
- `src/pages/Analytics.tsx`
- `src/components/analytics/AnalyticsHeader.tsx`
- `src/components/analytics/AnalyticsFilters.tsx`
- `src/components/analytics/OperationsAnalytics.tsx`
- `src/components/analytics/UberOneAnalysis.tsx`
- `src/components/analytics/OffersAnalyticsSection.tsx`
- `src/lib/brandScope.ts`

Objectif : la résolution du scope utilise tous les restaurants actifs de la marque par défaut.

### Restaurants et sélecteurs
- `src/pages/Restaurants.tsx`
  - Retirer étoile pin/unpin, fonction `togglePin`, tri pinned-first, compteur pinned.
- `src/hooks/useChainRestaurants.ts`
  - `usePinnedRestaurants` devient inutile ou doit être remplacé par `useActiveRestaurants` selon usages restants.
- `src/components/menu/RestaurantSelector.tsx`
  - Liste alphabétique unique.
- `src/hooks/useRestaurantMenuPrices.ts`
- `src/hooks/useSimulatorRestaurantPrices.ts`
- `src/components/menu/ProfitabilityComparison.tsx`
- `src/components/menu/offers/SaveAsActionDialog.tsx`
- `src/components/messaging/WeeklyReports.tsx`
- `src/pages/ImportChecklist.tsx`

## Vérifications après implémentation

1. `/overview` affiche **101 restaurants suivis** pour Chicken Street.
2. Les KPIs ne sont plus à `--` si la période contient des données.
3. La barre Répartition CA réseau reste visible avec Uber / Deliveroo / Caisse.
4. Le tableau comparatif liste les restaurants réseau, plus le message "Aucun restaurant épinglé trouvé".
5. Aucune référence UI à "Épinglés" ne reste dans les dashboards.

## Note importante

Aucune migration base nécessaire : on ne touche pas aux données ni aux accès. C'est un correctif frontend + nettoyage UI.