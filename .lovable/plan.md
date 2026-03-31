

## Objectif
Corriger le bug où les IDU ne s'affichent pas quand un restaurant est présent dans le dataset IDU quotidien mais pas encore dans le dataset annuel des adhérents.

## Fichiers à modifier (3)

### 1. `src/components/analytics/EcoContributionSection.tsx` (lignes 169-189)

**Après** la création de `entries` depuis `result.results.map(...)`, ajouter un fallback IDU :

```typescript
const hasResults = result.count > 0;
const iduEntries = result.idu_results || [];
const entries = result.results.map(r => {
  const matchingIdu = iduEntries.find(i => i.filiere === r.filiere);
  return {
    filiere: r.filiere,
    org: r.raison_sociale_ecoorganisme,
    start: fmtDateShort(r.date_debutvalidite_inscription) || "—",
    end: r.date_finvalidite_inscription,
    isActive: !r.date_finvalidite_inscription || new Date(r.date_finvalidite_inscription) > new Date(),
    idu: matchingIdu?.identifiant_unique,
  };
});

// Fallback : IDU présent mais pas encore dans le dataset annuel
if (!hasResults && iduEntries.length > 0) {
  for (const idu of iduEntries) {
    entries.push({
      filiere: idu.filiere || "—",
      org: "Non encore enregistré (adhésion en cours)",
      start: "—",
      end: null,
      isActive: true,
      idu: idu.identifiant_unique,
    });
  }
}

const finalStatus = hasResults || iduEntries.length > 0 ? "inscrit" : "non_trouve";

map.set(rId, {
  status: finalStatus,
  filiereCount: result.count || iduEntries.length,
  orgs: [...new Set(result.results.map(r => r.raison_sociale_ecoorganisme).filter(Boolean))],
  iduEntries,
  entries,
});
```

**Ligne 300** (flash status) : même correction
```typescript
const status = result && (result.count > 0 || (result.idu_results || []).length > 0) ? "ok" : "alert";
```

### 2. `src/components/analytics/RepMembershipSection.tsx` (lignes 68-92)

Même pattern :

```typescript
// Après entries = result.results.map(...)
if (!hasResults && iduEntries.length > 0) {
  for (const idu of iduEntries) {
    entries.push({
      filiere: idu.filiere || "—",
      org: "Non encore enregistré (adhésion en cours)",
      start: "—",
      end: null,
      isActive: true,
      idu: idu.identifiant_unique,
    });
  }
}

const finalStatus = hasResults || iduEntries.length > 0 ? "inscrit" : "non_trouve";

return {
  id: rId, name,
  status: finalStatus,
  result,
  filiereCount: result.count || iduEntries.length,
  orgs: [...new Set(result.results.map(r => r.raison_sociale_ecoorganisme).filter(Boolean))],
  filieres: [...new Set([...result.results.map(r => r.filiere), ...iduEntries.map(i => i.filiere)].filter(Boolean))],
  iduEntries,
  entries,
};
```

### 3. `src/hooks/useRepCheckPersistence.ts` (lignes 94-106)

Le snapshot doit aussi refléter le statut "inscrit" quand seuls des IDU existent :

```typescript
if (result.count > 0 || (result.idu_results || []).length > 0) {
  inscrit++;
  results[r.id] = {
    restaurant_id: r.id,
    status: "inscrit",
    filiereCount: result.count || (result.idu_results || []).length,
    orgs: [...new Set(result.results.map(r => r.raison_sociale_ecoorganisme).filter(Boolean))],
    idus: (result.idu_results || []).map(i => i.identifiant_unique),
  };
} else {
  nonTrouve++;
  results[r.id] = { restaurant_id: r.id, status: "non_trouve", filiereCount: 0, orgs: [], idus: [] };
}
```

## Résultat
Un restaurant avec un IDU mais sans entrée dans le dataset annuel apparaîtra comme **"inscrit"** avec son numéro IDU et la mention "Non encore enregistré (adhésion en cours)" au lieu d'être marqué "non trouvé".

## Aucune migration SQL nécessaire

