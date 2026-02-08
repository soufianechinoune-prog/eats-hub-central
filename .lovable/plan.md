

# Corriger le matching des restaurants - Comparer les villes uniquement

## Problème identifié

L'algorithme de similarité compare les noms complets des restaurants, ce qui donne des faux positifs car le préfixe "Chicken Street - " est toujours identique. Résultat :
- "Chicken Street - Athis-Mons" matche avec "Chicken Street - Amiens" (78%)
- "Chicken Street - Antony" matche avec "Chicken Street - Vannes"
- "Chicken Street - Juvisy" matche avec "Chicken Street - Chalon"
- "Chicken Street - Bonneuil" matche avec "Chicken Street - Montreuil"

## Solution

Extraire la partie **après le tiret** (le nom de la ville) et comparer uniquement cette partie. Si les deux noms suivent le format "Marque - Ville", on ne compare que les villes.

## Modifications

**Fichier**: `src/lib/fuzzyMatch.ts`

Ajouter une nouvelle fonction qui extrait la partie "location" du nom :

```typescript
export const extractLocationPart = (name: string): string => {
  const normalized = normalizeName(name);
  // Si le nom contient " - ", on prend la partie après le dernier tiret
  const parts = normalized.split(" - ");
  if (parts.length >= 2) {
    return parts[parts.length - 1].trim();
  }
  return normalized;
};

export const calculateRestaurantSimilarity = (str1: string, str2: string): number => {
  const norm1 = normalizeName(str1);
  const norm2 = normalizeName(str2);
  
  // Match exact = 100%
  if (norm1 === norm2) return 100;
  
  // Extraire les parties "location" si format "Marque - Ville"
  const loc1 = extractLocationPart(str1);
  const loc2 = extractLocationPart(str2);
  
  // Si les deux ont une location extraite, comparer les locations
  if (loc1 !== norm1 && loc2 !== norm2) {
    // Les deux suivent le format "Marque - Ville"
    // Vérifier que les marques correspondent d'abord
    const brand1 = norm1.split(" - ")[0].trim();
    const brand2 = norm2.split(" - ")[0].trim();
    
    if (brand1 !== brand2) return 0; // Marques différentes = pas de match
    
    // Comparer uniquement les villes
    if (loc1 === loc2) return 100;
    return calculateSimilarity(loc1, loc2);
  }
  
  // Sinon, comparaison standard
  return calculateSimilarity(str1, str2);
};
```

**Fichier**: `src/pages/UberStoreMapping.tsx`

Utiliser `calculateRestaurantSimilarity` au lieu de `calculateSimilarity` et augmenter le seuil à 90% :

```typescript
import { normalizeName, calculateRestaurantSimilarity } from "@/lib/fuzzyMatch";

const SIMILARITY_THRESHOLD = 90; // Plus strict maintenant qu'on compare les villes

// Dans la boucle de matching (ligne 175)
const similarity = calculateRestaurantSimilarity(storeName, restaurant.name);
```

## Résultat attendu

Après cette modification :
- "Chicken Street - Athis-Mons" ne matchera plus avec "Chicken Street - Amiens" (similarité ~50% sur les villes)
- Seuls les restaurants avec exactement le même nom de ville seront matchés
- Les 4 historiques (Athis-Mons, Antony, Juvisy, Bonneuil) apparaîtront en "À créer" s'ils n'ont pas déjà un vrai UUID

