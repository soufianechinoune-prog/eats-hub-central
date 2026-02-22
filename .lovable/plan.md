

## Ajouter une option "Exporter uniquement les restaurants pas a 100%"

### Ce qui change

Ajout d'un **menu deroulant** sur les boutons PDF et Excel pour proposer deux options :
- **Tous les restaurants** (comportement actuel)
- **Hors 100% uniquement** (filtre les restaurants a 100% de disponibilite)

### Implementation

**Fichier : `src/pages/DowntimeComparison.tsx`**

Modifier les boutons PDF et Excel pour utiliser un `DropdownMenu` avec deux options chacun :
- "Tous les restaurants" → exporte `restaurantStats` tel quel
- "Hors 100% uniquement" → exporte `restaurantStats.filter(s => s.availabilityRate < 100)`

Les KPIs (insights) seront recalcules en fonction du sous-ensemble filtre pour que le resume du PDF/Excel soit coherent avec les donnees exportees.

**Fichier : `src/hooks/useDowntimeExport.ts`**

Aucune modification necessaire -- le filtrage se fait en amont, avant d'appeler `exportPdf` / `exportExcel`.

### Detail technique

Dans `DowntimeComparison.tsx`, les deux handlers (`handleExportPdf`, `handleExportExcel`) seront transformes en une seule fonction parametree `handleExport(type: "pdf" | "excel", onlyImperfect: boolean)` qui :
1. Filtre les stats si `onlyImperfect` est vrai
2. Recalcule les insights sur le sous-ensemble
3. Appelle `exportPdf` ou `exportExcel`

Les boutons "PDF" et "Excel" deviennent chacun un `DropdownMenu` avec :
- "Tous les restaurants (14)"
- "Hors 100% (9)" ← le nombre est dynamique

