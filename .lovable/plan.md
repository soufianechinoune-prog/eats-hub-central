

## Plan : Corriger la normalisation des noms et la limite de 500

### Diagnostic

Le vrai bug : **les alias de restaurants ne matchent jamais** dans certains parseurs.

- Le frontend (`UnknownStoreMapping.tsx`) stocke les alias avec `normalizeForAlias` qui supprime **tout** sauf `a-z0-9` (pas d'espaces)
- `parse-downtime-report` utilise `normalizeRestaurantName` qui **garde les espaces** → l'alias lookup échoue systématiquement
- `parse-reviews-item` et `parse-payment-report` utilisent `.replace(/[^a-z0-9]/g, '')` qui supprime aussi les espaces → OK, ça matche
- `parse-reviews-order` utilise déjà `normalizeForAlias` → OK
- `parse-report-csv` n'a pas de normalize → pas concerné (le conseil de ton avis était faux sur ce fichier)

Le `.limit(500)` sur `restaurant_uber_ids` est un vrai risque si tu as beaucoup de mappings.

### Corrections

**1. Aligner `parse-downtime-report` sur la normalisation du frontend**

Remplacer la fonction `normalizeRestaurantName` (ligne 64-72) par :
```typescript
function normalizeRestaurantName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
```
Supprimer les `.replace(/[^a-z0-9\s]/g, '')` et `.replace(/\s+/g, ' ')` qui créent le décalage.

**2. Supprimer `.limit(500)` dans 3 fichiers**

| Fichier | Ligne |
|---------|-------|
| `parse-downtime-report/index.ts` | 144 |
| `parse-reviews-item/index.ts` | 172 |
| `parse-reviews-order/index.ts` | 206 |
| `parse-payment-report/index.ts` | 399 (restaurants) et 417 (uber_ids) |

**3. Fichiers modifiés**
- `supabase/functions/parse-downtime-report/index.ts` — normalisation + suppression limit
- `supabase/functions/parse-reviews-item/index.ts` — suppression limit
- `supabase/functions/parse-reviews-order/index.ts` — suppression limit
- `supabase/functions/parse-payment-report/index.ts` — suppression 2× limit

### Ce que ça ne change PAS
- `parse-report-csv` : pas de normalize, pas de limit → pas touché
- La logique de tirets (`[-–—]` → espaces) proposée par ton avis n'est pas nécessaire : puisqu'on supprime tout sauf `a-z0-9`, les tirets sont déjà éliminés

### Résultat attendu
Les alias créés manuellement via l'UI matcheront correctement dans tous les parseurs, et les 276 lignes ignorées devraient être récupérées au prochain import.

