

## Plan : Corriger l'import reviews_order (doublons dans le batch)

### Problème
Les logs de la fonction montrent : `"ON CONFLICT DO UPDATE command cannot affect row a second time"` sur tous les batches. Le CSV contient des lignes dupliquées (même `uber_order_id`), et PostgreSQL interdit de faire un UPSERT sur la même clé deux fois dans la même commande INSERT.

Résultat : 24 077 lignes en erreur, 0 insérées.

### Correction

**Fichier : `supabase/functions/parse-reviews-order/index.ts`**

Avant de découper en batches et d'insérer, dédupliquer les reviews par `uber_order_id` :
- Utiliser une `Map<string, review>` pour ne garder que la dernière occurrence de chaque `uber_order_id`
- Les lignes sans `uber_order_id` sont conservées telles quelles
- Ajouter un compteur `duplicatesRemoved` dans les stats pour traçabilité

Le code de déduplication sera placé juste après la boucle de parsing (ligne ~375), avant le bloc d'insertion par batch.

### Résultat attendu
- Les doublons intra-fichier sont éliminés avant l'insert
- L'upsert fonctionne normalement (1 seule ligne par `uber_order_id` par batch)
- Les 24 077 lignes seront réduites aux lignes uniques et insérées correctement

