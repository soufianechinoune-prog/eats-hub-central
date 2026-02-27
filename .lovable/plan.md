

# Filtrer Bangkok Factory de l'alerte "Restaurants non reconnus"

## Probleme

L'alerte "Restaurants non reconnus" affiche Bangkok Factory - Melun meme quand il est exclu (badge barre). L'exclusion empeche l'import mais ne supprime pas le nom de la liste `allUnmatched`.

## Correctif

Dans `DeliverooImportTab.tsx`, ligne 358 : filtrer `allUnmatched` pour exclure les noms presents dans `excludedRestaurantNames`.

```typescript
const allUnmatched = [...new Set(fileValidations.flatMap(fv => fv.unmatchedNames))]
  .filter(name => !excludedRestaurantNames.has(name));
```

## Fichier modifie
- `src/components/reports/DeliverooImportTab.tsx` — 1 ligne

