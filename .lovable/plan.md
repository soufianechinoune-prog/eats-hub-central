

## Problème

L'alerte "Incohérence : 13 503 lignes comptabilisées sur 10 125 totales" est un faux positif. Le parser `parse-inaccurate-orders` éclate correctement les lignes CSV multi-articles (séparées par `|`) en plusieurs enregistrements, donc `inserted > totalRows` est attendu. Le code de cohérence (ligne 2194) vérifie `expandedRecords` pour afficher un message bleu informatif au lieu du warning jaune, mais cette valeur n'est jamais propagée lors du traitement par chunks.

## Correction

**Fichier** : `src/pages/ReportImport.tsx`

1. **Accumuler `expandedRecords`** dans la boucle de chunks (vers ligne 1160) :
   - Ajouter une variable `totalExpandedRecords` initialisée à 0
   - Additionner `chunkResult.stats?.expandedRecords || 0` à chaque chunk

2. **Inclure dans le résultat agrégé** (ligne 1219-1226) :
   - Ajouter `expandedRecords: totalExpandedRecords > 0 ? totalExpandedRecords : undefined` dans l'objet `stats`

Cela permettra au check de cohérence existant (ligne 2197) de détecter correctement que les enregistrements ont été "expanded" et d'afficher le message bleu informatif au lieu du warning jaune trompeur.

