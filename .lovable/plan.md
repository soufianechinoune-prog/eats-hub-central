

## Plan : Uniformiser la résolution des restaurants dans tous les parseurs

### Problème confirmé
Les parseurs `parse-reviews-order`, `parse-reviews-item`, `parse-payout-summary` et `parse-sales-over-time` ne consultent pas `restaurant_name_aliases`. La fonction de normalisation diffère aussi entre `UnknownStoreMapping.tsx` et ces parseurs.

### Correction

**Fichiers à modifier (4 parseurs backend) :**

1. `supabase/functions/parse-reviews-order/index.ts`
2. `supabase/functions/parse-reviews-item/index.ts`
3. `supabase/functions/parse-payout-summary/index.ts`
4. `supabase/functions/parse-sales-over-time/index.ts`

**Dans chacun, ajouter :**

A. La fonction de normalisation identique à celle de `UnknownStoreMapping.tsx` :
```typescript
function normalizeForAlias(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
```

B. Le fetch de la table `restaurant_name_aliases` :
```typescript
const { data: nameAliases } = await supabase
  .from('restaurant_name_aliases')
  .select('normalized_name, restaurant_id');
```

C. La logique de matching en 4 étapes (dans cet ordre) :
1. UUID / store_id exact
2. UUID secondaire via `restaurant_uber_ids`
3. Alias via `restaurant_name_aliases` (avec `normalizeForAlias`)
4. Nom normalisé exact + fallback fuzzy

D. La remontée des `unknownStoreIds` et `unknownStoreDetails` dans la réponse de validation pour alimenter l'interface de mapping.

**Fichier UI (aucun changement nécessaire)** : `ReportImport.tsx` relance déjà automatiquement `handleValidate()` après mapping — une fois les parseurs corrigés, la boucle fonctionnera.

### Résultat attendu
- Quel que soit le type de rapport importé, les alias déjà enregistrés sont reconnus immédiatement
- Plus besoin de remapper les mêmes restaurants
- La normalisation est identique partout

### Aucune migration SQL nécessaire
La table `restaurant_name_aliases` existe déjà avec la bonne structure.

