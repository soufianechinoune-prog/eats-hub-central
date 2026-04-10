

# Correction : remonter les restaurants inconnus dans parse-downtime-report

## Probleme

`parse-downtime-report` incrémente `stats.skipped` quand un restaurant n'est pas trouvé, mais ne renvoie jamais de champ `validation.unknownStoreIds`. L'UI (`ReportImport.tsx`) cherche exclusivement `chunkResult.validation.unknownStoreIds` pour afficher l'alerte rouge et le composant de mapping. Résultat : 276 lignes ignorées silencieusement sans explication.

## Correction (1 seul fichier)

**Fichier : `supabase/functions/parse-downtime-report/index.ts`**

1. Ajouter deux variables de tracking après la ligne `const rowsToInsert`:
```typescript
const unknownStoreIds = new Set<string>();
const unknownStoreDetails: Record<string, { name: string; type: string }> = {};
```

2. Remplacer le bloc "restaurant not found" (lignes 292-298) :
```typescript
if (!matchedRestaurant) {
  result.stats.skipped++;
  const restaurantName = colIndices.restaurantName !== undefined 
    ? values[colIndices.restaurantName]?.trim() || 'unknown' 
    : 'unknown';
  const storeId = colIndices.storeId !== undefined 
    ? values[colIndices.storeId]?.trim() || '' 
    : '';
  const identifier = storeId || restaurantName;
  unknownStoreIds.add(identifier);
  unknownStoreDetails[identifier] = { 
    name: restaurantName, 
    type: storeId ? 'uber_store_id' : 'restaurant_name' 
  };
  continue;
}
```

3. Dans les deux `return new Response(JSON.stringify(result), ...)` (dryRun à ligne 387 et final à ligne 416), remplacer par `JSON.stringify({ ...result, validation: { ... } })` pour ajouter :
```typescript
validation: {
  unknownStoreIds: Array.from(unknownStoreIds),
  unknownStoreDetails,
  dateRange: result.dateRange,
  restaurants: Object.entries(result.restaurantStats).map(([name]) => ({ name })),
}
```

## Résultat attendu

- L'UI affichera l'alerte rouge avec le nom exact du restaurant non reconnu (ex: "Chicken Street - Lens")
- Le composant `UnknownStoreMapping` apparaitra pour permettre le mapping
- Le bouton "Confirmer l'import" sera bloqué tant que le mapping n'est pas fait
- Aucun changement nécessaire côté front, le contrat `validation.unknownStoreIds` est déjà géré

