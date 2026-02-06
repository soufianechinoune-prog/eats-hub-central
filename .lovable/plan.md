
# Plan : Adapter le mapping pour accepter le fichier des avis

## Problème identifié

Le fichier CSV des avis (`restaurant_rating_local_*.csv`) a ces colonnes :
| Colonne | Exemple |
|---------|---------|
| `Restaurant` | Chicken Street - Annemasse |
| `Id. externe du restaurant` | BYS00293 (optionnel) |

Mais le code de mapping cherche :
- `store_id` → non trouvé
- `store_name` → non trouvé

## Solution

Modifier `UberStoreMapping.tsx` pour reconnaître les colonnes du fichier d'avis Uber Eats :

```text
// Headers à chercher (ordre de priorité)
store_id: "store_id", "id. externe du restaurant", "restaurant_id"
store_name: "store_name", "restaurant", "restaurant_name"
```

## Modifications techniques

### Fichier : `src/pages/UberStoreMapping.tsx`

**Ligne 79-84** - Ajouter la reconnaissance des nouvelles colonnes :

```typescript
// AVANT
const storeIdIndex = headers.findIndex(h => 
  h.includes("store_id") || h.includes("restaurant_id") || h === "store id"
);
const storeNameIndex = headers.findIndex(h => 
  h.includes("store_name") || h.includes("restaurant_name") || h === "store name"
);

// APRES
const storeIdIndex = headers.findIndex(h => 
  h.includes("store_id") || 
  h.includes("id. externe du restaurant") ||
  h.includes("restaurant_id") || 
  h === "store id"
);
const storeNameIndex = headers.findIndex(h => 
  h.includes("store_name") || 
  h === "restaurant" ||
  h.includes("restaurant_name") || 
  h === "store name"
);
```

**Ligne 86-93** - Gérer le cas où `store_id` est optionnel (certains restaurants n'ont pas d'ID externe) :

```typescript
// Permettre le matching par nom uniquement si pas de store_id
if (storeIdIndex === -1 && storeNameIndex === -1) {
  toast({
    title: "Format CSV non reconnu",
    description: "Le fichier doit contenir au minimum une colonne 'Restaurant' ou 'store_name'",
    variant: "destructive",
  });
  return;
}

// Mode "nom uniquement" si pas de colonne store_id
const useNameAsId = storeIdIndex === -1;
```

**Ligne 95-112** - Adapter l'extraction pour utiliser le nom comme clé si pas d'ID :

```typescript
// Extract unique stores
const storesMap = new Map<string, string>();
for (let i = 1; i < lines.length; i++) {
  // ...parsing...
  
  // Utiliser l'ID externe s'il existe, sinon générer un ID basé sur le nom
  const rawStoreId = useNameAsId ? null : cells[storeIdIndex];
  const storeName = cells[storeNameIndex];
  
  if (storeName) {
    // Clé = ID externe si disponible, sinon hash du nom
    const storeKey = rawStoreId && rawStoreId.trim() 
      ? rawStoreId.trim() 
      : `name:${normalizeName(storeName)}`;
    
    if (!storesMap.has(storeKey)) {
      storesMap.set(storeKey, storeName);
    }
  }
}
```

## Résultat attendu

Après cette modification :
1. Tu uploades le fichier `restaurant_rating_local_*.csv`
2. Le système détecte ~60 restaurants uniques par leur nom
3. Tu fais le matching visuel avec les restaurants en base
4. Tu enregistres → les `uber_store_id` sont renseignés
5. Tu peux ré-importer les avis → ils seront correctement associés

## Fichiers à modifier

| Fichier | Action |
|---------|--------|
| `src/pages/UberStoreMapping.tsx` | Adapter la détection des colonnes pour supporter le format du fichier d'avis |
