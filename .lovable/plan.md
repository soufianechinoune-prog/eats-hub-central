

## Problème : Limite de 1000 lignes sur le RPC `get_yearly_payouts_detail`

### Diagnostic

La table `payouts` contient **5207 lignes pour 2025** (91 restaurants × ~57 versements). Or, Supabase applique une **limite par défaut de 1000 lignes** sur les résultats RPC. Le nouveau `get_yearly_payouts_detail` retourne donc seulement les 1000 premières lignes au lieu des 5207 → données tronquées, CA sous-estimé.

### Solution

Appliquer le **pattern de pagination `.range()`** déjà utilisé ailleurs dans le projet (cf. `useRestaurantMenuPrices`, `useRestaurantProfitability`) sur l'appel RPC dans `Analytics.tsx`.

**Fichier modifié** : `src/pages/Analytics.tsx` (~lignes 533-549)

Remplacer l'appel direct :
```typescript
supabase.rpc('get_yearly_payouts_detail', { p_year, p_restaurant_ids })
```

Par une boucle de pagination :
```typescript
async function fetchAllYearlyPayouts(year, restaurantIds) {
  const PAGE_SIZE = 1000;
  let allData = [];
  let from = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .rpc('get_yearly_payouts_detail', { p_year: year, p_restaurant_ids: restaurantIds })
      .range(from, from + PAGE_SIZE - 1);
    
    if (error) throw error;
    if (data) allData.push(...data);
    hasMore = data?.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  return allData;
}
```

Puis appeler cette fonction pour chaque année (3 appels paginés en parallèle).

### Impact

- Récupération de **100% des lignes** (5207+ pour 2025, ~5000 pour 2024, etc.)
- Le CA réseau affiché correspondra à la réalité
- Aucun changement SQL nécessaire

