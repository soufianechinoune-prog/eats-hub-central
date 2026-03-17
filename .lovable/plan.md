
Problème identifié

- Sur ce rapport d’erreurs de commande, les lignes ignorées ont `storeId=""` dans le détail d’erreur.
- Le parser `parse-inaccurate-orders` utilise alors le nom du restaurant comme “clé inconnue”.
- Mais le composant `UnknownStoreMapping` traite toujours cette clé comme un vrai `store_id` et l’enregistre dans `restaurant_uber_ids`.
- C’est pour ça que “Chicken Street - Goussainville” a été sauvegardé comme faux identifiant, ce qui ne peut pas corriger le parsing.
- En plus, la base contient le restaurant sous le nom `Chicken Street - Goussainvillie`, donc le fallback actuel par nom ne matche pas cette orthographe.

Plan d’implémentation

1. Séparer les inconnus par type
- Faire remonter depuis le parser si l’inconnu est un vrai `store_id` ou un `nom de restaurant`.
- Réserver `restaurant_uber_ids` aux seuls identifiants Uber réels.

2. Ajouter un vrai système d’alias de nom
- Créer une table dédiée du type `restaurant_name_aliases` liée à `restaurants`.
- Y stocker les noms validés manuellement depuis l’import, avec version normalisée pour le matching.
- Ajouter RLS/policies cohérentes avec le backend existant.

3. Corriger `parse-inaccurate-orders`
- Charger les alias de noms en plus des restaurants et des IDs Uber.
- Résoudre dans cet ordre : `store_id` → alias de nom → nom normalisé/fuzzy match.
- Tolérer les petites variantes d’orthographe comme `Goussainville` / `Goussainvillie`.

4. Corriger l’UI de mapping
- Afficher un libellé correct selon le cas :
  - `Store ID non reconnu`
  - `Nom de restaurant non reconnu`
- Si l’inconnu est un nom, enregistrer un alias de nom au lieu d’écrire dans `restaurant_uber_ids`.
- Garder le comportement actuel pour les vrais `store_id`.

5. Nettoyer la donnée déjà polluée
- Migrer/supprimer les entrées non valides déjà écrites dans `restaurant_uber_ids`, notamment `Chicken Street - Goussainville`.
- Si possible, les recopier dans la table d’alias avant suppression.

6. Clarifier le flux après validation
- Après `Appliquer et revalider` sur l’écran de résultat, relancer automatiquement la validation du fichier courant ou afficher un CTA explicite `Réimporter ce fichier`.
- Expliquer clairement que le mapping est bien enregistré, mais que les lignes déjà ignorées ne sont pas importées rétroactivement sans nouvelle passe.

Détails techniques

- Fichiers à modifier :
  - `supabase/functions/parse-inaccurate-orders/index.ts`
  - `src/components/reports/UnknownStoreMapping.tsx`
  - `src/pages/ReportImport.tsx`
  - une migration SQL pour la table d’alias
- Point confirmé en base :
  - le restaurant existe bien en `Chicken Street - Goussainvillie`
  - une ligne incorrecte a déjà été créée dans `restaurant_uber_ids` avec `uber_store_id = "Chicken Street - Goussainville"`

Résultat attendu

- Goussainville sera reconnu même quand le CSV ne fournit pas de `store_id`.
- Le mapping manuel deviendra persistant et correct.
- L’interface ne présentera plus un nom de restaurant comme si c’était un `store_id`.
- Les prochains imports de ce fichier ne laisseront plus ces lignes en ignorées pour cette raison.
