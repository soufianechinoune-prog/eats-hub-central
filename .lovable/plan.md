

# Fix : Même data quelle que soit la marque sélectionnée

## Diagnostic

Le problème vient de la **vue "Épinglés"** (14 restaurants épinglés). Les 14 restaurants épinglés appartiennent **tous** à Chicken Street. Donc quand tu passes de "Toutes les marques" à "Chicken Street", le filtre appliqué est identique (les mêmes 14 IDs) → mêmes données.

La logique actuelle dans `resolveBrandScopedRestaurantIds` en mode Épinglés :
- "Toutes les marques" → 14 IDs épinglés
- "Chicken Street" → 14 IDs épinglés (les mêmes, puisqu'aucun épinglé n'est TASTY CROUSTY)

**C'est techniquement correct**, mais trompeur. En mode **Réseau**, le résultat serait bien différent (157 vs 101 restaurants).

## Ce que je vais corriger

### 1. Forcer la vue Réseau quand on change de marque
Dans `AppSidebar.tsx`, quand l'utilisateur change de marque, basculer automatiquement en vue Réseau pour que le changement soit immédiatement visible dans les données :

```tsx
// AppSidebar.tsx — dans handleChainChange
setIsNetworkView(true); // forcer la vue réseau au changement de marque
```

### 2. Fix performance : `get_profitability_daily` timeout
Les logs console montrent des timeouts `57014` sur `get_profitability_daily`. Cette fonction n'est pas encore `SECURITY DEFINER`. Migration SQL :

```sql
ALTER FUNCTION public.get_profitability_daily(date, date, uuid[], text)
  SECURITY DEFINER SET search_path = public;
```

### 3. Même traitement pour les autres fonctions non optimisées
`get_availability_daily` et `get_monthly_sales_from_daily` ne sont pas non plus `SECURITY DEFINER`. Les corriger en même temps pour éviter de futures timeouts.

## Fichiers modifiés
- `src/components/layout/AppSidebar.tsx` — ajouter `setIsNetworkView(true)` au changement de marque
- Nouvelle migration SQL — SECURITY DEFINER sur `get_profitability_daily`, `get_availability_daily`, `get_monthly_sales_from_daily`

## Résultat attendu
- Changer de marque → passage automatique en vue Réseau → données différentes selon la marque
- Plus de timeouts sur les graphiques de rentabilité

