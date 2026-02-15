

# Forcer le match "Chicken Street - Lille" vers Lille Wazemmes

## Changement

Ajouter un mapping explicite dans la fonction `findRestaurantByPartialName` du fichier `supabase/functions/parse-inaccurate-orders/index.ts`.

Avant la logique de matching par ville (ligne 118), ajouter une verification : si le nom CSV normalise correspond exactement a "chicken street - lille" (sans suffixe), retourner directement le restaurant Lille Wazemmes (ID `b81531ef-d5db-47dd-b0bb-37f2c9fd6d5d`).

```text
// Hardcoded match for "Chicken Street - Lille" -> Lille Wazemmes
const lowerName = csvName.toLowerCase().trim();
if (lowerName === 'chicken street - lille' || lowerName === 'chicken street lille') {
  const wazemmes = Array.from(restaurantByName.values()).find(r => r.id === 'b81531ef-d5db-47dd-b0bb-37f2c9fd6d5d');
  if (wazemmes) {
    console.log(`Hardcoded match: "${csvName}" -> "${wazemmes.name}"`);
    return wazemmes;
  }
}
```

## Fichier modifie

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/parse-inaccurate-orders/index.ts` | Ajouter le mapping explicite "Lille" -> Lille Wazemmes avant le matching generique |

## Resultat attendu

Les 393 lignes "Chicken Street - Lille" seront automatiquement rattachees a **Lille Wazemmes** sans ambiguite.

