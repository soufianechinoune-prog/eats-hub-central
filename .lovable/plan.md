

## Objectif
Ajouter un matching souple des filières pour associer les IDU aux entrées d'adhérents quand les libellés diffèrent entre datasets.

## Fichiers à modifier (2)

### 1. `src/components/analytics/EcoContributionSection.tsx` (ligne 172)

**Avant :**
```typescript
const matchingIdu = iduEntries.find(i => i.filiere === r.filiere);
```

**Après :**
```typescript
const matchingIdu = iduEntries.find(i => i.filiere === r.filiere)
  || (iduEntries.length === 1 ? iduEntries[0] : undefined);
```

### 2. `src/components/analytics/RepMembershipSection.tsx` (ligne 71)

Même changement exactement.

## Logique
1. D'abord matching exact par filière
2. Si pas de match ET un seul IDU pour ce SIRET → l'associer directement
3. Pas de table de correspondance complexe

## Après application
Publication du site pour test en production.

