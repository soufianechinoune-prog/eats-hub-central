

## Accelerer l'import des articles sans surcharger la base

### Probleme actuel

L'import traite les batches de 50 articles **un par un** avec 300ms de pause entre chaque. Pour un fichier de ~85k lignes, cela prend beaucoup de temps.

### Optimisations

**Fichier : `supabase/functions/parse-item-report/index.ts`**

#### 1. Paralleliser les upserts (2 batches simultanes)

Au lieu de traiter batch 1, attendre, batch 2, attendre... on lance 2 batches en parallele. Cela double le debit tout en restant sous le seuil de connexions.

```
Avant:  [batch1] --300ms-- [batch2] --300ms-- [batch3] --300ms-- [batch4]
Apres:  [batch1 + batch2] --150ms-- [batch3 + batch4] --150ms-- ...
```

#### 2. Augmenter la taille des chunks de lecture (flow ID lookup)

Passer de 50 a 200 pour la recherche des commandes parentes. Les lectures sont legeres et ne bloquent pas la base.

- Ligne 342 : `CHUNK_SIZE = 50` -> `LOOKUP_CHUNK_SIZE = 200`
- Appliquer aux lookups de flow IDs et d'items existants (dry run)

#### 3. Reduire le delai inter-batch

Passer de 300ms a 150ms entre les paires de batches paralleles.

### Details techniques

**Changement principal (lignes 554-593)** - Remplacer la boucle sequentielle par une boucle parallele :

```typescript
const CONCURRENCY = 2;
const INTER_BATCH_DELAY = 150;

for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE * CONCURRENCY) {
  const batchPromises = [];
  
  for (let c = 0; c < CONCURRENCY; c++) {
    const start = i + c * BATCH_SIZE;
    if (start >= recordsToUpsert.length) break;
    const batch = recordsToUpsert.slice(start, start + BATCH_SIZE);
    batchPromises.push(upsertWithRetry(supabase, batch, Math.floor(start / BATCH_SIZE)));
  }
  
  const results = await Promise.all(batchPromises);
  // aggregate counts...
  
  if (i + BATCH_SIZE * CONCURRENCY < recordsToUpsert.length) {
    await new Promise(resolve => setTimeout(resolve, INTER_BATCH_DELAY));
  }
}
```

**Changement lookup (ligne 342)** :
```typescript
const LOOKUP_CHUNK_SIZE = 200; // was 50
```

**Extraire la logique retry dans une fonction helper** pour garder le code lisible :
```typescript
async function upsertWithRetry(supabase, batch, batchIndex, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { error } = await supabase
      .from('order_items')
      .upsert(batch, { onConflict: 'order_id,item_id', ignoreDuplicates: false });
    if (!error) return { success: true, count: batch.length };
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  return { success: false, count: batch.length };
}
```

### Gains estimes

- Debit upsert : x2 (2 batches en parallele)
- Lookups : x4 plus rapide (chunks 200 vs 50)
- Delai total reduit de moitie environ
- Risque de surcharge : faible (2 connexions simultanees reste conservateur)

### Fichiers modifies

- `supabase/functions/parse-item-report/index.ts`

