
Diagnostic court : non, pas sur la version précédente. Après vérification, le problème n’est pas “l’affichage des plats”, c’est que ton fichier SKU est encore importé comme `Avis (commandes)` au lieu de `Avis (articles)`.

Ce que j’ai confirmé :
- Le dernier import de `restaurant_rating_sku_local...csv` a bien été enregistré dans `csv_imports` avec `report_type = reviews_order`, pas `reviews_item`.
- `parse-reviews-item` n’a pas de logs récents.
- `parse-reviews-order` a bien traité ce fichier à 07:30 avec `15 726 inserted`.
- `menu_item_reviews` n’a toujours aucune donnée après `2026-02-01` (`0` ligne à partir de mars 2026).

Pourquoi mon correctif précédent n’était pas suffisant :
- Ton vrai header SKU est de ce type :
  `UUID de la commande`, `Date de la commande`, `Nom du plat`, `Prix du plat`, `Catégorie du menu`, `Valeur de la note`, `Commentaire`
- Or le code actuel détecte `reviews_item` seulement avec des libellés trop stricts :
  `Note de l'article` + `Titre de l'article`
- Résultat : comme ton fichier contient aussi `Valeur de la note` + `UUID de la commande`, il retombe encore dans `reviews_order`.

Plan corrigé

1. Corriger la signature de détection `reviews_item`
- Utiliser les vraies variantes Uber du CSV SKU :
  - titre article : `Nom du plat` / `Titre de l'article` / `Nom de l'article` / `Item title`
  - note article : `Valeur de la note` / `Note de l'article` / `Item rating`
  - identifiant commande : `UUID de la commande`
  - colonnes renforçantes : `Prix du plat`, `Catégorie du menu`, `Id. externe de l'article`

2. Appliquer la correction partout où le type est décidé
- `src/pages/ReportImport.tsx`
- `src/components/reports/BulkImportTab.tsx`
- `src/lib/reportImportConfig.ts`
Ainsi, preview + validation + import final utiliseront exactement la même logique.

3. Ajouter une garde anti-erreur dans l’UI d’import
- Afficher clairement : `Type détecté : Avis (articles)`
- Ajouter un warning si un fichier contient `Nom du plat` mais est encore réglé sur `Avis (commandes)`

4. Réimporter ensuite le fichier SKU
- Une fois le routage corrigé, le fichier ira enfin vers `parse-reviews-item`
- Les lignes seront insérées dans `menu_item_reviews`
- L’onglet `Plats` se remplira alors normalement

Détail technique important
- Je ne propose pas pour l’instant de supprimer automatiquement les imports SKU déjà partis dans `customer_reviews`, car on n’a pas de marqueur fiable pour distinguer sans risque les lignes mal routées des vraies lignes order-level. Le plus sûr est : corriger le routage d’abord, puis réimporter correctement.

Fichiers à corriger
- `src/pages/ReportImport.tsx`
- `src/components/reports/BulkImportTab.tsx`
- `src/lib/reportImportConfig.ts`
