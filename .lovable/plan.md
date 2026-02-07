
# Correction des erreurs d'import Downtime (33 500 erreurs)

## Diagnostic

L'erreur PostgreSQL **"ON CONFLICT DO UPDATE command cannot affect row a second time"** survient dans le parser `parse-downtime-report` car :

1. Le fichier CSV Uber Eats contient des **lignes dupliquées** (meme restaurant + meme heure + meme plateforme)
2. Le parser envoie ces doublons dans le meme batch INSERT
3. PostgreSQL refuse car ON CONFLICT ne peut pas traiter deux fois la meme ligne dans un seul INSERT

**Pourquoi les autres parsers fonctionnent ?**
Les parsers `parse-payment-report` et `parse-item-report` ont une **etape de deduplication** (Phase 1.5) qui fusionne les doublons avant l'upsert. Le parser `parse-downtime-report` n'a pas cette logique.

---

## Solution

Ajouter une etape de deduplication avant l'insertion, similaire aux autres parsers.

---

## Fichier a modifier

`supabase/functions/parse-downtime-report/index.ts`

---

## Modifications

### 1. Ajouter la deduplication apres la boucle de parsing (ligne 309)

Avant l'insertion, dedupliquer par cle unique `(restaurant_id, hour_start, platform)` :

```typescript
// Deduplicate by (restaurant_id, hour_start, platform)
// Keep last occurrence and merge minutes if needed
const deduplicatedMap = new Map<string, any>();

for (const row of rowsToInsert) {
  const key = `${row.restaurant_id}::${row.hour_start}::${row.platform}`;
  const existing = deduplicatedMap.get(key);
  
  if (existing) {
    // Merge: take max values (they should be identical, but just in case)
    existing.menu_availability_minutes = Math.max(
      existing.menu_availability_minutes || 0, 
      row.menu_availability_minutes || 0
    );
    existing.online_minutes = Math.max(
      existing.online_minutes || 0, 
      row.online_minutes || 0
    );
    existing.offline_minutes = Math.max(
      existing.offline_minutes || 0, 
      row.offline_minutes || 0
    );
  } else {
    deduplicatedMap.set(key, { ...row });
  }
}

const deduplicatedRows = Array.from(deduplicatedMap.values());
console.log(`Deduplicated: ${rowsToInsert.length} → ${deduplicatedRows.length} rows (${rowsToInsert.length - deduplicatedRows.length} duplicates merged)`);
```

### 2. Utiliser `deduplicatedRows` pour l'insertion (ligne 328)

Remplacer `rowsToInsert` par `deduplicatedRows` dans la boucle d'insertion :

```typescript
for (let i = 0; i < deduplicatedRows.length; i += BATCH_SIZE) {
  const batch = deduplicatedRows.slice(i, i + BATCH_SIZE);
  // ... reste du code identique
}
```

### 3. Mettre a jour le compteur dryRun (ligne 318-323)

```typescript
if (dryRun) {
  result.stats.inserted = deduplicatedRows.length;
  // ...
}
```

---

## Resultat attendu

| Avant | Apres |
|-------|-------|
| 63 687 lignes totales | 63 687 lignes totales |
| 30 152 inserees | ~30 187 inserees |
| 33 500 erreurs | 0 erreurs |
| 35 ignorees | 35 ignorees |

Les ~33 500 "erreurs" etaient en fait des doublons dans le CSV. Une fois dedupliques cote application, PostgreSQL pourra traiter tous les upserts sans conflit.

---

## Cause probable des doublons dans le CSV

Le fichier Uber Eats `menu_downtime_local` peut contenir des doublons si :
- Le meme rapport couvre plusieurs periodes qui se chevauchent
- Les donnees sont exportees par restaurant ET par periode, creant des repetitions
- Bug cote Uber Eats dans la generation du rapport

Cette correction rend le parser resilient face a ce type de donnees.
