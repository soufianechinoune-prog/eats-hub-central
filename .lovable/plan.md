
Pourquoi ça arrive

- Le mapping que tu fais est bien sauvegardé dans la base via `UnknownStoreMapping.tsx` :
  - noms CSV → `restaurant_name_aliases`
  - UUID/store IDs → `restaurant_uber_ids`
- Le vrai problème est ensuite dans `ReportImport.tsx` :
  - l’écran affiche encore le résultat de l’analyse/import déjà calculé avant ton mapping
  - à l’étape 4, le callback `onMappingComplete` ne fait qu’un toast, il ne recalcule pas le fichier
- Donc les correspondances existent bien, mais elles ne sont pas reprises dans le résultat affiché tant qu’on ne relance pas réellement la validation/import. C’est pour ça que tu as l’impression de devoir recommencer.

Plan de correction

1. Corriger le flux après mapping dans `src/pages/ReportImport.tsx`
- Ajouter un état du type `mappingApplied` / `isRevalidatingAfterMapping`
- Après clic sur “Appliquer et revalider” :
  - invalider les queries utiles
  - relancer automatiquement `handleValidate()` sur le fichier déjà chargé
  - mettre à jour l’écran avec le nouveau `validationResult`
- Sur l’étape 4, remplacer le simple toast par une vraie réanalyse du fichier, ou un bouton clair “Réanalyser ce fichier” qui exécute cette action

2. Corriger le wording/UI de `src/components/reports/UnknownStoreMapping.tsx`
- Le bouton dit aujourd’hui “Appliquer et revalider”, mais en étape 4 il ne revalide pas vraiment
- Rendre le callback plus explicite et afficher un état visuel :
  - “enregistrement des mappings…”
  - “réanalyse en cours…”
  - puis succès avec disparition ou mise à jour du bloc rouge

3. Uniformiser la résolution des restaurants dans les parseurs
- Vérifier et aligner :
  - `supabase/functions/parse-payment-report/index.ts`
  - `supabase/functions/parse-order-history/index.ts`
  - `supabase/functions/parse-inaccurate-orders/index.ts`
  - `supabase/functions/parse-downtime-report/index.ts`
- Ordre de matching à standardiser :
  1. restaurant forcé si sélectionné
  2. `uber_store_id`
  3. `restaurant_uber_ids`
  4. `restaurant_name_aliases`
  5. nom exact normalisé
  6. fallback partiel/fuzzy
- Point déjà vu dans le code : `parse-downtime-report` lit les alias de noms mais pas les UUID secondaires. Ce n’est pas forcément ton bug actuel, mais c’est une incohérence à corriger pour éviter d’autres cas “ça n’a pas pris mon mapping”.

Résultat attendu

- Une fois le mapping fait, le même fichier est immédiatement recontrôlé
- Les restaurants déjà mappés ne réapparaissent plus dans le bloc “non reconnus”
- Le mapping reste réutilisé pour les imports suivants, sans refaire la manipulation

Détails techniques

- Cause principale côté UI :
  - étape 3 : `onMappingComplete` relance bien `handleValidate()`, mais sans UX claire
  - étape 4 : `onMappingComplete` n’affiche qu’un toast et ne relance pas l’analyse
- Cause secondaire potentielle côté backend :
  - logique de matching pas totalement homogène entre les différentes fonctions d’import

Vérifications après implémentation

- Rejouer exactement le cas de ton screenshot sur `/report-import`
- Mapper plusieurs restaurants, cliquer “Appliquer et revalider”, vérifier que la liste rouge se met à jour sans repartir de zéro
- Réimporter le même fichier une seconde fois et vérifier qu’aucun remapping n’est demandé
- Tester au moins `payment_order_level` et `inaccurate_orders`
