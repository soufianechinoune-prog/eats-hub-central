

# Corriger le matching pour les 4 restaurants historiques

## Problème identifié

Les 4 restaurants historiques ont des `uber_store_id` de type placeholder (`name:...` ou `BYS00708`), pas de vrais UUIDs. L'outil de mapping devrait les matcher par nom et proposer "Renommer", mais le matching échoue car :

- CSV : `Chicken Street - Bonneuil`
- DB : `CHICKEN STREET BONNEUIL-SUR-MARNE`

Le problème spécifique : `Bonneuil` ≠ `Bonneuil-sur-Marne` après normalisation.

## Solution

Améliorer la fonction `cityStartsWith` pour gérer les suffixes composés comme "-sur-Marne", "-sur-Orge" qui sont souvent absents des noms CSV.

## Modifications techniques

### Fichier : `src/lib/fuzzyMatch.ts`

Modifier `cityStartsWith` pour traiter les suffixes "-sur-..." et "-en-..." :

```typescript
export const cityStartsWith = (shortName: string, fullName: string): boolean => {
  const shortNorm = normalizeForLooseMatch(shortName);
  const fullNorm = normalizeForLooseMatch(fullName);
  
  // Extract city parts (after brand)
  const brandWords = ["chicken", "street", "cs"];
  const shortParts = shortNorm.split(" ").filter(w => !brandWords.includes(w));
  const fullParts = fullNorm.split(" ").filter(w => !brandWords.includes(w));
  
  const shortCity = shortParts.join(" ");
  let fullCity = fullParts.join(" ");
  
  // Remove common French suffixes like "sur marne", "sur orge", "en france"
  fullCity = fullCity
    .replace(/ sur [a-z]+$/, "")
    .replace(/ en [a-z]+$/, "")
    .replace(/ les [a-z]+$/, "")
    .trim();
  
  // Direct comparison after suffix removal
  if (shortCity === fullCity) return true;
  
  // Prefix check
  return fullCity.startsWith(shortCity) || shortCity.startsWith(fullCity);
};
```

### Fichier : `src/pages/UberStoreMapping.tsx`

Aucune modification nécessaire - le code utilise déjà `cityStartsWith`. Une fois la fonction corrigée, le matching fonctionnera.

## Résultat attendu

Après cette correction :

| CSV | DB | Match |
|-----|-----|-------|
| Chicken Street - Bonneuil | CHICKEN STREET BONNEUIL-SUR-MARNE | ✅ 95% |
| Chicken Street - Juvisy | CHICKEN STREET JUVISY-SUR-ORGE | ✅ 95% |
| Chicken Street - Athis-Mons | CHICKEN STREET ATHIS-MONS | ✅ 100% |
| Chicken Street - Antony | CHICKEN STREET ANTONY | ✅ 100% |

Les 4 restaurants s'afficheront en **"Renommer"** (badge bleu) :
- Le nom passera au format CSV (ex: "Chicken Street - Bonneuil")
- L'UUID sera mis à jour avec le vrai UUID du CSV
- **Toutes les données historiques seront préservées** car elles sont liées à l'ID interne du restaurant, pas au nom

