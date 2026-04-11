

# Fix : afficher les vrais montants dans le détail article des commandes

## Problème

Le composant `OrderItemsDropdown` affiche `sales_incl_vat` qui vaut **toujours 0** dans la table `order_items`. Les montants réels sont dans `sales_excl_vat` et `unit_price`.

## Correction — `src/components/analytics/OrderItemsDropdown.tsx`

1. **Requête** : ajouter `sales_excl_vat`, `unit_price`, `total_price` au `select`
2. **Affichage** : utiliser `sales_excl_vat` comme montant principal (avec fallback sur `unit_price * quantity`), et afficher le label "HT" pour clarifier
3. **Layout enrichi** : afficher le prix unitaire et le montant total par ligne pour une vraie ventilation :
   - `{quantity}x {item_title}` — `{unit_price} € x {quantity} = {total HT}`

## Résultat

Les lignes articles afficheront les vrais montants au lieu de "0,00 €".

