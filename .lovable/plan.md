

# Corriger le matching "Chicken Street - Lille" dans l'Edge Function

## Probleme identifie

Dans la fonction `findRestaurantByPartialName` (ligne 132 de `parse-inaccurate-orders/index.ts`), quand le nom "Chicken Street - Lille" est cherche, la partie ville "lille" matche deux restaurants :
- "Chicken Street - Lille Flandres"  
- "Chicken Street - Lille Wazemmes"

La condition `if (matches.length === 1)` echoue car il y a 2 resultats, et la fonction retourne `null`. Les 393 lignes sont donc ignorees.

Le mapping interactif a ete ajoute mais ne s'affiche pas car le build n'etait probablement pas pret lors du test (le screenshot montre "Starting live preview...").

## Solution : double approche

### 1. Edge Function : accepter le premier match quand il y a ambiguite (fichier `supabase/functions/parse-inaccurate-orders/index.ts`)

Modifier la logique a la ligne 132-137 pour que, au lieu de retourner `null` quand `matches.length > 1`, la fonction :
- Log un warning avec les candidats trouves
- Retourne quand meme le premier match (par ordre alphabetique)
- Continue a remonter le nom dans `unknownStoreIds` pour informer l'utilisateur

Cela permet d'importer les donnees immediatement tout en signalant l'ambiguite.

```text
if (matches.length === 1) {
  return matches[0];
}
if (matches.length > 1) {
  // Ambiguous but pick first match rather than losing data
  console.log(`Ambiguous match: "${csvName}" -> ${matches.map(m => m.name).join(', ')} - picking first`);
  return matches[0];
}
```

### 2. Frontend : garder le mapping interactif en place (deja fait)

Les changements precedents sur `ReportImport.tsx` (collecte des `unknownStoreIds` dans les chunks + affichage du composant `UnknownStoreMapping`) restent en place comme filet de securite pour les futurs cas ambigus.

## Impact

Les 393 lignes seront automatiquement rattachees au premier restaurant "Lille" trouve (probablement Lille Flandres par ordre alphabetique). Si ce n'est pas le bon, l'utilisateur pourra supprimer et re-importer apres avoir configure le mapping.

## Details techniques

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/parse-inaccurate-orders/index.ts` | Modifier `findRestaurantByPartialName` pour accepter le premier match quand plusieurs candidats |

