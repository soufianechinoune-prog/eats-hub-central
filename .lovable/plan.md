

# Diagnostic : les 101 565 articles ignorés sont un effet cascade

## Cause racine

C'est le **même problème de restaurant non reconnu** qui cascade :

1. Tu importes les **commandes** (Niveau commande) → "Chicken Street - Lens" n'est pas reconnu → ses ~101 565 commandes sont **silencieusement ignorées** (skipped) dans `parse-payment-report`
2. Tu importes ensuite les **articles** (Niveau articles) → le parseur cherche les `uber_flow_id` dans la table `orders` → les commandes de Chicken Street - Lens n'y sont pas → les articles sont marqués comme **orphelins**

Le message "101 565 ignorées" est trompeur : ce ne sont pas des orphelins au sens "commandes manquantes", c'est que les commandes n'ont jamais été importées car le restaurant n'est pas mappé.

## Preuve

Tes imports "Niveau commande" montrent aussi des écarts :
- 17 028 lignes → 15 894 traitées → **~1 134 ignorées**
- 350 156 lignes → 326 864 traitées → **~23 292 ignorées**

Ces lignes ignorées correspondent vraisemblablement à Chicken Street - Lens dans les commandes.

## Correction

Le fix qu'on a déjà appliqué sur `parse-downtime-report` (remonter `unknownStoreIds` dans `validation`) doit être **vérifié aussi dans `parse-payment-report`** — c'est lui qui traite les commandes.

**Fichier : `supabase/functions/parse-payment-report/index.ts`**

1. Vérifier que quand un restaurant n'est pas trouvé, le parseur remplit bien `validation.unknownStoreIds` et `unknownStoreDetails` (pas juste `stats.skipped`)
2. Si ce n'est pas le cas, appliquer la même correction que pour `parse-downtime-report`

**Fichier : `src/pages/ReportImport.tsx`**

3. Dans l'agrégation des chunks (lignes 1300-1321), ajouter la fusion de `orphanInfo` pour que l'alerte orange s'affiche correctement sur les imports articles

## Résultat attendu

- À l'import des **commandes**, l'UI bloquera et affichera "Chicken Street - Lens" comme restaurant inconnu → tu pourras le mapper
- Une fois mappé et les commandes réimportées, l'import **articles** trouvera les flow_ids → plus d'orphelins
- L'alerte orphelins (orange) s'affichera correctement même sur les gros fichiers découpés en chunks

## Ordre d'action

1. Mapper "Chicken Street - Lens" via l'UI (si le fix `parse-downtime-report` fonctionne déjà, fais un import downtime pour déclencher le mapping)
2. Réimporter les commandes → Chicken Street - Lens sera reconnu
3. Réimporter les articles → les orphelins disparaîtront

