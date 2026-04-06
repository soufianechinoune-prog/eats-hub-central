

## Plan : Enrichir la liste des avis clients avec plus de données

### Contexte
Actuellement, chaque ligne d'avis dans l'onglet "Clients" affiche uniquement : note, date, panier, tags, icône commentaire (tooltip), plateforme. Les données des deux CSV importés (order + SKU) contiennent bien plus d'infos : date de commande, date de note, nom des plats commandés, prix, catégorie, commentaire client.

### Problème technique
Les plats commandés (CSV SKU `restaurant_rating_sku_local`) sont stockés dans `menu_item_reviews` mais **sans `uber_order_id`**, ce qui empêche de les relier aux avis clients (`customer_reviews`). Il faut d'abord créer ce lien.

### Corrections

**Etape 1 — Migration SQL : ajouter `uber_order_id` à `menu_item_reviews`**
- Ajouter la colonne `uber_order_id` (text, nullable) à `menu_item_reviews`
- Ajouter aussi `item_price` (numeric, nullable) et `menu_category` (text, nullable) qui sont dans le CSV mais pas stockés actuellement
- Créer un index sur `uber_order_id` pour les jointures

**Etape 2 — Modifier `parse-reviews-item/index.ts`**
- Mapper les colonnes CSV `Prix du plat` et `Catégorie du menu`
- Stocker `orderUuid` dans le champ `uber_order_id`, `item_price`, et `menu_category` lors de l'insertion

**Etape 3 — Modifier `useReviews.ts`**
- Enrichir `CustomerReview` avec `order_date` (déjà présent dans le select mais pas affiché)
- Créer un nouveau hook `useReviewItems(uberOrderIds)` qui charge les plats associés à un lot d'avis visibles (chargement à la demande, pas 74K lignes)

**Etape 4 — Refondre `CompactReviewRow` en design expandable**
- Vue compacte (ligne) : Note | Date commande | Date avis | Panier | Tags | Plateforme
- Afficher les 2 dates (commande + avis) au lieu d'une seule
- Au clic sur la ligne, expansion avec :
  - Commentaire client affiché en entier (texte intégral, pas tooltip)
  - Liste des plats commandés : nom, prix, catégorie (chargés via le hook)
- Design propre avec un fond légèrement différent pour la zone expandée

**Etape 5 — Adapter `ReviewsCustomerList`**
- Mettre à jour le header de la table avec les nouvelles colonnes
- Gérer l'état d'expansion (un seul avis ouvert à la fois)
- Charger les items associés uniquement pour l'avis ouvert (performance)

### Fichiers modifiés
- Migration SQL (nouvelle colonne + index)
- `supabase/functions/parse-reviews-item/index.ts` (stocker uber_order_id, prix, catégorie)
- `src/hooks/useReviews.ts` (nouveau hook items)
- `src/components/reviews/CompactReviewRow.tsx` (design expandable)
- `src/components/reviews/ReviewsCustomerList.tsx` (header + expansion)

### Remarque importante
Après ce changement, il faudra **ré-importer le fichier SKU** (`restaurant_rating_sku_local`) pour que les plats soient liés aux avis via `uber_order_id`.

