

## Correction de l'incohérence affichée pour les imports "Commandes incorrectes"

### Probleme identifie

Le rapport "Commandes incorrectes" (`inaccurate_orders`) divise chaque ligne CSV en plusieurs enregistrements quand la colonne "Articles incorrects" contient plusieurs articles separes par `|`. Cela signifie que `inserted` (2 495) peut legitimement depasser `totalRows` (1 808).

Le compteur de coherence dans l'UI compare `inserted + updated + skipped + errors` avec `totalRows`, ce qui declenche un faux avertissement.

### Solution

Deux modifications complementaires :

1. **Edge Function `parse-inaccurate-orders`** : Ajouter un champ `expandedRecords` dans la reponse pour indiquer combien d'enregistrements ont ete generes par l'expansion des articles (le nombre total de records crees vs le nombre de lignes CSV).

2. **Frontend `ReportImport.tsx`** : Adapter le calcul de coherence pour prendre en compte cette expansion. Quand `inserted > totalRows` et que le rapport est de type `inaccurate_orders`, ne pas afficher l'alerte d'incoherence, ou afficher un message explicatif neutre (info, pas warning).

### Details techniques

**Fichier : `supabase/functions/parse-inaccurate-orders/index.ts`**
- Ajouter `stats.expandedFromRows = result.stats.totalRows` dans la reponse
- Modifier `totalRows` pour refleter le nombre reel de records generes (`recordsToUpsert.length`) au lieu du nombre de lignes CSV
- Alternative plus simple : garder `totalRows` = lignes CSV et laisser le frontend gerer

**Fichier : `src/pages/ReportImport.tsx`** (zone du coherence check, lignes ~2144-2158)
- Modifier la condition de coherence pour tolerer `accounted > total` quand le type de rapport genere naturellement plus de records que de lignes (inaccurate_orders, potentiellement item_issues_leaderboard)
- Remplacer l'alerte d'avertissement par un message informatif neutre : "2 495 enregistrements crees a partir de 1 808 lignes (articles multiples par commande)"

### Approche retenue

La solution la plus propre : la fonction edge retourne un nouveau champ `stats.expandedRecords` indiquant le nombre de records generes. Le frontend utilise ce champ pour ajuster l'affichage :
- Si `expandedRecords` existe et est superieur a `totalRows`, afficher un badge informatif bleu au lieu d'une alerte orange
- Le message explique : "X enregistrements crees a partir de Y lignes (articles multiples par commande)"

