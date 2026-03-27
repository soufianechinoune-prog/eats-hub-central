

## Filtrer la liste des restaurants par marque active dans l'import

### Problème
La page d'import (`ReportImport.tsx`) charge **tous** les restaurants actifs sans tenir compte de la marque sélectionnée. Quand tu es sur "TASTY Crousty", le dropdown de mapping propose les restaurants Chicken Street.

### Solution
Ajouter le filtre `chain_id` à la query `restaurants-for-import` (ligne 256-267 de `ReportImport.tsx`), en utilisant `selectedChainId` du `useAnalyticsContext()`.

### Fichier modifié
- `src/pages/ReportImport.tsx`
  - Importer `useAnalyticsContext`
  - Ajouter `selectedChainId` dans le `queryKey`
  - Ajouter `.eq("chain_id", selectedChainId)` quand une chaîne est sélectionnée
  - Appliquer le même filtre au sélecteur de restaurant pré-import (si présent)

### Résultat
En étant sur "TASTY Crousty", seuls les restaurants de cette marque apparaîtront dans le dropdown de mapping. L'option "+ Créer nouveau restaurant" restera disponible pour créer un restaurant rattaché à la bonne marque.

