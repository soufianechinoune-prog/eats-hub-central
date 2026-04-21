

## Fix : persister IDU + entries dans le snapshot REP

### Diagnostic confirmé
Ton ingénieure a raison. Deux trous :
1. `RepSnapshotEntry` (hook `useRepCheckPersistence`) ne stocke qu'une liste de strings `idus[]` et ne stocke **pas** les `entries` (filière + dates d'adhésion).
2. Le fallback dans `EcoContributionSection.tsx` (lignes 219-220) force `iduEntries: []` et `entries: []`, donc tout disparaît au rechargement de la page tant qu'on ne relance pas le scan.

### Corrections

#### 1. `src/hooks/useRepCheckPersistence.ts`
Étendre `RepSnapshotEntry` pour inclure les données détaillées :

```ts
export interface RepSnapshotIdu {
  identifiant_unique: string;
  filiere?: string | null;
}

export interface RepSnapshotEntryDetail {
  filiere: string;
  org: string;
  start: string;       // déjà formatée "JJ/MM/AAAA"
  end: string | null;  // brut ISO ou null
  isActive: boolean;
  idu?: string;
}

export interface RepSnapshotEntry {
  restaurant_id: string;
  status: RepStatus;
  filiereCount: number;
  orgs: string[];
  idus: string[];                     // conservé pour compat (compteurs/changes)
  iduEntries?: RepSnapshotIdu[];      // NOUVEAU
  entries?: RepSnapshotEntryDetail[]; // NOUVEAU
}
```

Modifier `saveSnapshot` pour calculer et persister ces deux champs en réutilisant exactement la même logique de mapping que celle de `EcoContributionSection.tsx` (lignes 175-200), afin que le contenu en cache soit identique au contenu live.

Pas de migration SQL nécessaire : la colonne `results` est déjà `jsonb` et accepte les nouveaux champs facultatifs.

#### 2. `src/components/analytics/EcoContributionSection.tsx`
Restaurer les deux champs depuis le cache (lignes 215-221) :

```tsx
map.set(rId, {
  status: cached.status,
  filiereCount: cached.filiereCount,
  orgs: cached.orgs || [],
  iduEntries: cached.iduEntries || [],   // ← restauré
  entries: cached.entries || [],         // ← restauré
});
```

### Compatibilité avec les snapshots existants
Les anciens snapshots (déjà en base) n'ont pas `iduEntries` ni `entries` → le fallback `|| []` garantit qu'ils ne plantent pas. Ils retrouveront leurs IDU au prochain scan, qui réécrira un snapshot complet.

### Fichiers modifiés
- `src/hooks/useRepCheckPersistence.ts` — types étendus + `saveSnapshot` enrichi
- `src/components/analytics/EcoContributionSection.tsx` — fallback du `latestSnapshot` qui restaure `iduEntries` et `entries`

### Résultat attendu
- Au rechargement de la page (sans relancer le scan), les badges IDU bleus et les dates d'adhésion s'affichent à nouveau sous chaque restaurant adhérent.
- Aucun changement de comportement quand le scan vient d'être relancé (live data inchangée).
- Les anciens snapshots restent lisibles (juste sans IDU/dates jusqu'au prochain scan).

