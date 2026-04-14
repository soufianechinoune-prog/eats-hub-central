<final-text>## Diagnostic
- Le `0` affiché n’est pas fiable: les logs montrent que la requête Uber échoue avec `57014: canceling statement due to statement timeout`.
- Sur `Mars 2026`, la page est en vue mensuelle mais `useDataGranularity` bascule en `daily` pour une période de 31 jours. Donc `/analytics/revenue` appelle `get_daily_revenue_from_orders`, pas la RPC mensuelle.
- La migration précédente a optimisé `get_monthly_revenue_from_orders`, mais pas `get_daily_revenue_from_orders`. Résultat: la vue année peut être mieux, mais la vue mois reste lente.
- Le front aggrave l’attente:
  1. la requête Uber revenue a `retry: 3`, donc elle relance plusieurs timeouts,
  2. en vue `revenue`, le code charge encore Uber + Deliveroo même si l’onglet actif est seulement `Uber Eats`,
  3. `isLoading` attend encore les deux plateformes en mode revenue.

## Code à appliquer
### 1) Backend
Appliquer la même optimisation à la RPC journalière:
```sql
ALTER FUNCTION public.get_daily_revenue_from_orders(date, date, uuid[])
  SECURITY DEFINER
  SET search_path = public;
```

### 2) Frontend `src/pages/Analytics.tsx`
Ajouter des flags par plateforme:
```ts
const shouldLoadUberRevenue =
  needsRevenue &&
  isRestaurantScopeReady &&
  (selectedPlatform === "uber_eats" || selectedPlatform === "global");

const shouldLoadDeliverooRevenue =
  needsRevenue &&
  isRestaurantScopeReady &&
  (selectedPlatform === "deliveroo" || selectedPlatform === "global");
```

Puis les utiliser pour:
- `uberRevenueData`
- `deliverooRevenueData`
- `uberFeesData`
- `deliverooFeesData`
- leurs datasets N-1 associés

Exemple:
```ts
enabled: shouldLoadUberRevenue
```

### 3) Éviter les faux chargements interminables
Sur les requêtes revenue lourdes, couper les retries de timeout:
```ts
retry: (count, error: any) => error?.code !== "57014" && count < 1
```
ou plus simplement:
```ts
retry: false
```

### 4) Ne plus afficher un faux zéro
Ajouter un état d’erreur visible si la requête revenue échoue, au lieu de tomber sur des KPIs vides qui ressemblent à `0 €`.

## Pourquoi tu vois zéro aujourd’hui
- Ce n’est pas forcément “zéro commande”.
- Aujourd’hui, la requête expire avant de renvoyer les données.
- L’UI finit donc avec des données absentes/vides et affiche visuellement `0`, ce qui masque en réalité une erreur backend.

## Vérification après correction
- Ouvrir `/analytics/revenue`
- Sélection `Uber Eats`
- Période `Mars 2026`
- Vérifier:
  - plus de log `57014`
  - chargement nettement plus court
  - plus d’attente inutile sur Deliveroo
  - vraies valeurs si les commandes existent
  - sinon message clair “aucune donnée importée”, pas un faux zéro</final-text>