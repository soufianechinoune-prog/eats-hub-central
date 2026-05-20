# Pourquoi l'onglet "Historique frais 0,89€" affiche 0€

## Constat
- Tu es sur `/analytics/offers`, marque **Chicken Street**, période **Mars 2026**.
- L'écran montre `0€` partout (frais, commandes taxées, sparkline vide).
- **La donnée existe pourtant en base** : j'ai testé la RPC `get_offers_analytics` côté serveur avec les 104 restaurants actifs de Chicken Street sur mars 2026 → **11 560,27 € de frais, 11 156 commandes taxées, 92 lignes mensuelles**.

Donc le bug est **côté front** : la RPC n'est pas appelée avec les bons paramètres au bon moment.

## Cause la plus probable
Dans `OffersAnalyticsSection.tsx`, le hook fire **immédiatement** sans attendre que `useActiveRestaurants` ait résolu :

```
restaurantIds = resolveBrandScopedRestaurantIds(...) ?? []
useOffersAnalytics(restaurantIds, startDate, endDate, restaurants)
```

Au premier render :
- `activeRestaurants = []` (encore en chargement)
- `chainRestaurantIds = []`
- `selectedChainId = "110e05b8…"` (Chicken Street)
- `resolveBrandScopedRestaurantIds` renvoie alors le **sentinel** `['00000000-0000-0000-0000-000000000000']`
- La RPC fire avec ce sentinel → 0 lignes → **résultat mis en cache 5 min via `staleTime`**

Quand `activeRestaurants` arrive 200 ms plus tard, la queryKey change et une nouvelle query devrait partir avec les 104 vrais IDs. Mais selon l'état React Query / l'ordre des rerenders, la première réponse vide reste affichée jusqu'au prochain refetch manuel. C'est exactement le pattern documenté dans la mémoire projet (`analytics-ready-guard` + `useActiveRestaurants` sentinel).

C'est aussi pour ça que la **page Synthèse** (ancienne) ne montrait pas le bug avant : elle bénéficiait d'un refetch après navigation. La nouvelle hero du tab Historique rend immédiatement les KPI à 0 et c'est très visible.

## Plan de correction

### 1. Gate du hook sur les restaurants chargés
Dans `src/components/analytics/OffersAnalyticsSection.tsx` :
- Récupérer aussi `isLoading: restaurantsLoading` depuis `useActiveRestaurants()`.
- Garder un état "ready" qui ne devient `true` que lorsque :
  - `selectedChainId === null` (mode multi-marques admin), **ou**
  - `chainRestaurantIds.length > 0`.
- Tant que pas ready : afficher le spinner existant à la place de `<Tabs>`.

Effet : la RPC ne part **jamais** avec le sentinel `0000…`, plus de cache vide bloquant.

### 2. Filet de sécurité dans `useOffersAnalytics`
Dans `src/hooks/useOffersAnalytics.ts`, ajouter à `enabled` :
```
enabled: !!startDate && !!endDate
  && !(restaurantIds.length === 1 && restaurantIds[0] === '00000000-0000-0000-0000-000000000000')
```
Idem pour la query prev-year et `success_scores`.

### 3. Vérification
- Recharger `/analytics/offers` sur Chicken Street / Mars 2026.
- Vérifier dans Network qu'**une seule** requête `get_offers_analytics` part, avec les 104 IDs réels.
- KPIs attendus : ~11 560 € de frais, 11 156 commandes taxées, frais moyen ≈ 1,04 €.
- Tester aussi : sélection mono-restaurant, sélection multi-restaurants explicite, période "Année".

## Hors scope
- Pas de modif RPC (elle est correcte).
- Pas de modif des autres tabs (Synthèse, Croisements) — ils consomment la même `OffersAnalyticsResult`, ils bénéficieront automatiquement du fix.
- Pas de migration LFL ni autre changement business.
