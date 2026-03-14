

## Bug : `enabled` placé dans les paramètres RPC au lieu des options useQuery

### Cause

Lors de l'optimisation précédente, le flag `enabled: needsPayouts` a été placé **à l'intérieur de l'objet paramètres** de `supabase.rpc()` au lieu d'être une option de `useQuery`. Résultat : Supabase reçoit `enabled` comme paramètre SQL et retourne l'erreur `Could not find the function get_monthly_payouts_summary(enabled, p_restaurant_ids, p_year)`.

Console log confirmant le bug :
```
Could not find the function public.get_monthly_payouts_summary(enabled, p_restaurant_ids, p_year)
```

### Correction

Deux lignes à corriger dans `src/pages/Analytics.tsx` :

**Ligne ~283-287** — Payouts année courante :
```typescript
// AVANT (bug) :
const { data, error } = await supabase.rpc('get_monthly_payouts_summary', {
  p_year: selectedYear,
  p_restaurant_ids: restaurantFilter || null,
  enabled: needsPayouts,  // ← DANS les params RPC
});
// ...
});  // ← fin useQuery sans enabled

// APRÈS (fix) :
const { data, error } = await supabase.rpc('get_monthly_payouts_summary', {
  p_year: selectedYear,
  p_restaurant_ids: restaurantFilter || null,
});
// ...
enabled: needsPayouts,  // ← DANS les options useQuery
});
```

**Ligne ~301-305** — Payouts année précédente : même correction exacte pour `prevPayoutsData`.

### Impact

Correction de 2 lignes. Les données Finances & Frais réapparaissent immédiatement.

