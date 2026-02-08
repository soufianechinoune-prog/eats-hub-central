
# Corriger la détection du format CSV dans l'outil de mapping

## Problème identifié

L'outil `/uber-mapping` rejette le fichier CSV payout car il cherche des en-têtes spécifiques (`Restaurant`, `store_name`, `restaurant_name`) alors que le fichier payout Uber Eats utilise **`Nom du restaurant`**.

## Solution

Ajouter `nom du restaurant` à la liste des en-têtes acceptés pour la colonne du nom du restaurant.

## Modification technique

**Fichier**: `src/pages/UberStoreMapping.tsx`

Ligne ~100 - Mettre à jour la détection de la colonne `storeName`:

```typescript
// AVANT
const storeNameIndex = headers.findIndex(
  (h) =>
    h.includes("store_name") ||
    h === "restaurant" ||
    h.includes("restaurant_name") ||
    h === "store name"
);

// APRÈS
const storeNameIndex = headers.findIndex(
  (h) =>
    h.includes("store_name") ||
    h === "restaurant" ||
    h.includes("restaurant_name") ||
    h.includes("nom du restaurant") ||  // Ajout pour fichiers payout
    h === "store name"
);
```

## Résultat attendu

Après cette modification, tu pourras :
1. Importer le fichier payout CSV sur `/uber-mapping`
2. L'outil détectera les 91 restaurants et proposera de mettre à jour les 87 avec placeholder ID vers les vrais UUIDs
3. Appliquer les changements
4. Retourner sur `/report-import` pour importer les payouts avec succès
