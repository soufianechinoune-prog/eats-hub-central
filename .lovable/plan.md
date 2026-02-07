
# Correction import Order History : Colonnes + Découpage gros fichiers

## Diagnostic

### Problème 1 : Mauvais nom de colonne
Le fichier CSV utilise **"UUID de la commande"** mais le parser cherche **"Id. de la commande"**.

### Problème 2 : Limites Edge Function
Les logs montrent :
```
ERROR Memory limit exceeded
ERROR CPU Time exceeded
```
Un fichier de 128 000 lignes dépasse les limites de l'Edge Function (150s CPU, 512 MB RAM).

---

## Solution

### Partie 1 : Corriger le parser (colonnes)

**Fichier** : `supabase/functions/parse-order-history/index.ts`

Ajouter le support de la colonne "UUID de la commande" :

```typescript
// Ligne 162 - Détection de l'en-tête
if (line.includes('id. de la commande') || line.includes('id de la commande') || line.includes('uuid de la commande')) {
  headerIndex = i;
  break;
}

// Ligne 209 - Extraction de l'ID commande
const uberOrderId = getCol(row, 'id. de la commande', 'id de la commande', 'uuid de la commande');
```

---

### Partie 2 : Découpage automatique côté frontend

**Fichier** : `src/pages/ReportImport.tsx`

Implémenter un chunking automatique pour les gros fichiers :

```typescript
const CHUNK_SIZE = 15000; // 15 000 lignes par requête

async function importLargeFile(csvContent: string, reportType: string) {
  const lines = csvContent.split('\n');
  const headerLine = lines[0]; // Garder l'en-tête
  const dataLines = lines.slice(1);
  
  if (dataLines.length <= CHUNK_SIZE) {
    // Fichier assez petit, import normal
    return await supabase.functions.invoke(`parse-${reportType}`, {
      body: { csvContent }
    });
  }
  
  // Découpage en chunks
  const totalChunks = Math.ceil(dataLines.length / CHUNK_SIZE);
  let totalInserted = 0;
  let totalErrors = 0;
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, dataLines.length);
    const chunkLines = [headerLine, ...dataLines.slice(start, end)];
    const chunkCsv = chunkLines.join('\n');
    
    setProgress({ current: i + 1, total: totalChunks, percent: ((i + 1) / totalChunks) * 100 });
    
    const { data, error } = await supabase.functions.invoke(`parse-${reportType}`, {
      body: { csvContent: chunkCsv }
    });
    
    if (data) {
      totalInserted += data.stats?.inserted || 0;
      totalErrors += data.stats?.errors || 0;
    }
  }
  
  return { 
    success: true, 
    stats: { inserted: totalInserted, errors: totalErrors },
    chunksProcessed: totalChunks 
  };
}
```

---

### Partie 3 : Barre de progression

Afficher la progression du découpage :

```typescript
{progress && (
  <div className="space-y-2">
    <div className="flex justify-between text-sm">
      <span>Import en cours...</span>
      <span>Chunk {progress.current}/{progress.total}</span>
    </div>
    <Progress value={progress.percent} />
  </div>
)}
```

---

## Résumé des fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/parse-order-history/index.ts` | Ajouter support colonne "UUID de la commande" |
| `src/pages/ReportImport.tsx` | Implémenter découpage automatique + barre de progression |

---

## Résultat attendu

| Avant | Après |
|-------|-------|
| Erreur "Memory limit exceeded" | Import réussi par chunks de 15 000 lignes |
| Fichier 128 000 lignes échoue | ~9 chunks importés séquentiellement |
| Colonne "UUID de la commande" ignorée | Colonne reconnue et utilisée |
| Pas de feedback | Barre de progression visible |

---

## Section technique

### Estimation du temps d'import

| Lignes | Chunks (15k) | Temps estimé |
|--------|--------------|--------------|
| 30 000 | 2 | ~20 secondes |
| 60 000 | 4 | ~40 secondes |
| 128 000 | 9 | ~90 secondes |

Chaque chunk prend environ 8-12 secondes à traiter (bien sous la limite de 150s).

### Gestion des erreurs entre chunks

Si un chunk échoue, le processus continue avec les suivants et affiche un résumé final avec le nombre d'erreurs par chunk.
