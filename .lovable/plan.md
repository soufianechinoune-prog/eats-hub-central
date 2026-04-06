
Diagnostic
- Oui, tu as bien importé le bon fichier : `restaurant_rating_sku_local_...csv`.
- Preuves :
  - le nom contient `sku`
  - les colonnes `Nom du plat`, `Prix du plat`, `Catégorie du menu`, `Id. externe de l'article`, `UUID de la commande` correspondent bien à un fichier `reviews_item`
  - l’écran de validation affiche `24 077 à insérer`, ce qui correspond à un import article par article. Si le fichier était encore classé comme `reviews_order`, on n’aurait pas ce volume-là.

Conclusion
- Le problème n’est donc plus “est-ce le bon fichier ?”.
- Le vrai blocage est pendant l’import réel.

Cause probable
- Dans `src/pages/ReportImport.tsx`, un gros fichier `reviews_item` n’est pas découpé en chunks.
- Dans `supabase/functions/parse-reviews-item/index.ts`, les lignes sont ensuite insérées une par une.
- Pour 24k lignes, ça peut faire tomber la fonction : ça colle avec le symptôme `FunctionsFetchError / Load failed` côté UI et les logs `shutdown` côté fonction.

Plan de correction
1. Sécuriser l’import des avis articles côté front
- Ajouter `reviews_item` aux types “gros fichiers” dans `src/pages/ReportImport.tsx` pour envoyer le CSV par paquets.
- Appliquer la même protection dans `src/components/reports/BulkImportTab.tsx`.

2. Optimiser `parse-reviews-item`
- Remplacer l’insertion ligne par ligne par des insertions par batch, sur le modèle de `parse-reviews-order`.
- Conserver les stats de validation/import.

3. Fiabiliser le parsing CSV
- Remplacer le `split('\n')` de `parse-reviews-item` par un parseur CSV robuste, pour supporter correctement les champs quotés et éviter les lignes cassées.

4. Améliorer le feedback dans l’UI
- Afficher clairement `Type détecté : Avis (articles)`.
- Mieux distinguer “mauvais type de fichier” et “fonction tombée pendant l’import”.

Résultat attendu
- Tu pourras réimporter ce même fichier SKU.
- Les 24 077 lignes seront traitées correctement sans faire tomber la fonction.
- L’onglet `Plats` pourra enfin se remplir.

Détails techniques
- Fichiers à modifier :
  - `src/pages/ReportImport.tsx`
  - `src/components/reports/BulkImportTab.tsx`
  - `supabase/functions/parse-reviews-item/index.ts`
- Aucun changement de table n’est nécessaire pour débloquer ce cas.
