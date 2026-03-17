

## Diagnostic : les 4 796 lignes "non comptabilisées"

### Cause

Le calcul côté client (ligne 2180 de `ReportImport.tsx`) fait :

```
accounted = inserted + updated + skipped + merged + errors
```

Mais il **oublie les ajustements** (`adjustments`) — les lignes sans identifiant de commande (éco-contribution, frais publicitaires, marketing, etc.) qui sont importées dans la table `payout_adjustments`. Ces lignes sont bien traitées et importées, mais pas comptées dans le total affiché.

Concrètement : **78 436 + 78 419 + 5 764 + 0 + 0 = 162 619**, alors que le total est 167 415. Les 4 796 manquantes = lignes d'ajustements importées avec succès.

Il y a aussi potentiellement des lignes avec moins de 5 colonnes qui sont silencieusement ignorées (`if (row.length < 5) continue`), mais ce sont généralement des lignes vides.

### Correction

**Fichier** : `src/pages/ReportImport.tsx` (ligne ~2180)

Ajouter `adjustments` au calcul de `accounted` :

```typescript
const accounted = importResult.stats.inserted + importResult.stats.updated 
  + importResult.stats.skipped + (importResult.stats.merged ?? 0) 
  + importResult.stats.errors + (importResult.stats.adjustments ?? 0);
```

Et afficher le nombre d'ajustements dans les KPI cards (ajouter une 7ème carte ou l'intégrer dans les stats existantes) pour que l'utilisateur voie clairement où vont ces lignes.

### Impact
- Supprime le warning "Incohérence" erroné
- Rend le comptage transparent et complet
- Aucun changement côté backend

