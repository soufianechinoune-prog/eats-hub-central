

## Plan : Corriger l'auto-détection du type de fichier SKU

### Problème
Le fichier `restaurant_rating_sku_local` contient à la fois les headers de `reviews_order` ("Valeur de la note", "UUID de la commande") et ceux de `reviews_item` ("Titre de l'article"). La détection `reviews_order` (ligne 573) est testée **avant** `reviews_item` (ligne 578), donc le fichier SKU est toujours mal classé comme `reviews_order`.

Résultat : les 15 726 lignes SKU sont envoyées à `parse-reviews-order` → insérées dans `customer_reviews` au lieu de `menu_item_reviews`. D'où les 0 données dans l'onglet "Plats".

### Correction

**1. `src/pages/ReportImport.tsx` — `detectReportType()`**
- Déplacer le test `reviews_item` **avant** `reviews_order` (lignes 577-581 avant 572-576)
- Le fichier SKU contient "Titre de l'article" qui est spécifique aux items → sera détecté correctement en premier
- Le fichier order-level ne contient PAS "Titre de l'article" → tombera toujours sur `reviews_order`

**2. `src/components/reports/BulkImportTab.tsx` — même correction**
- Appliquer le même réordonnancement dans la fonction de détection du bulk import

### Après la correction
L'utilisateur devra ré-importer le fichier SKU. Cette fois il sera correctement détecté comme `reviews_item` et les données iront dans `menu_item_reviews`.

### Fichiers modifiés
- `src/pages/ReportImport.tsx` (réordonnancer les tests de détection)
- `src/components/reports/BulkImportTab.tsx` (idem)

