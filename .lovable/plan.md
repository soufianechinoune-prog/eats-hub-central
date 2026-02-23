

## Improve Tab Readability in Operations Analytics

The operations sub-tabs ("Disponibilite", "Temps de prepa initial", "Temps d'attente du coursier (restaurant)", "Temps de prepa total", "Erreurs", "Uber One") are hard to read because the 6 tabs are forced into a fixed grid, causing long labels to overlap.

### Changes

**File: `src/components/analytics/OperationsAnalytics.tsx`**

1. Replace the rigid `grid grid-cols-6` layout with a flexible layout (`flex flex-wrap`) so tabs can take the space they need without overlapping
2. Shorten the longest label: "Temps d'attente du coursier (restaurant)" becomes "Attente coursier" on desktop too (the full label is unnecessarily verbose)
3. Reduce text size slightly (`text-xs`) to give more breathing room
4. Add `whitespace-nowrap` to prevent text wrapping inside individual tabs

### Technical Details

- **Line 570**: Change `TabsList` className from `grid w-full max-w-5xl grid-cols-6 h-12` to `flex flex-wrap w-full max-w-5xl h-auto gap-1`
- **Line 592**: Shorten desktop label from "Temps d'attente du coursier (restaurant)" to "Attente coursier"
- All `TabsTrigger` elements: add `whitespace-nowrap` and adjust padding for better fit

