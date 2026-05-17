## Diagnostic

L'erreur "Edge Function returned a non-2xx status code" lors de l'import groupé des temps de disponibilité provient de l'edge function `parse-downtime-report`.

Les logs montrent clairement :
```
ERROR CPU Time exceeded
```
précédé de centaines de lignes répétitives :
```
INFO Alias match: "Tasty Crousty - L'Haÿ-les-Roses" -> Tasty Crousty - Chevilly La Rue
```

Ce n'est **pas** lié à des restaurants manquants : la résolution d'identité fonctionne (les alias matchent bien). C'est un problème de **performance** :

1. La fonction loggue `console.log("Alias match: ...")` à **chaque ligne** du CSV. Un import groupé multi-restaurants × 30 jours × 24h = facilement 50 000+ lignes → 50 000+ logs.
2. Pour chaque ligne non trouvée dans la map principale, elle fait une boucle linéaire sur tous les restaurants (`for (const [key, value] of restaurantByNormalizedName.entries())`), donc O(N×M).
3. Pas de cache du résultat de matching par nom → le même nom est re-résolu pour chaque ligne d'un même restaurant.

Le CPU des edge functions Supabase est plafonné, et avec ce volume la fonction est tuée avant d'arriver à l'insert.

## Correctif

Modifier `supabase/functions/parse-downtime-report/index.ts` :

1. **Cache de résolution par nom** : créer une `Map<string, Restaurant>` qui mémorise le résultat (succès ou échec) pour chaque `restaurantName` rencontré. Toutes les lignes suivantes du même resto deviennent O(1).
2. **Logger uniquement la première occurrence** d'un alias match (une seule ligne `Alias match` par restaurant, pas par ligne CSV).
3. **Supprimer les `console.log` dans la boucle par ligne** (déduplication, parsing, etc.) — ne garder que les logs d'étapes (start, phase 1.5, phase 2, end).
4. **Pré-calcul des noms normalisés** : normaliser une seule fois tous les noms de restaurants au démarrage et stocker dans une Map directement requêtable, au lieu de scanner toutes les entrées.

## Détails techniques

Fichier : `supabase/functions/parse-downtime-report/index.ts`
- Lignes ~240-355 : boucle de parsing à alléger.
- Ligne 276 : `console.log("Alias match: ...")` → conditionner à un `Set<string>` des noms déjà loggués.
- Lignes 282-289 : remplacer la boucle linéaire par une lookup directe + cache.
- Garder l'upsert batch existant (lignes 410-430) qui est déjà correct.

Aucun changement de schéma DB, aucun changement UI. Pas de migration.

## Vérification après correctif

Re-tenter l'import groupé du même CSV : la fonction doit terminer en < 30s et retourner les stats (inserted/updated). Les logs doivent montrer au maximum quelques dizaines de lignes (une par restaurant matché par alias), pas des milliers.