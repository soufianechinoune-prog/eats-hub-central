# Mapper Chicken Street - O'Parinor sur Deliveroo

## Constat vérifié

- Le restaurant existe bien en base : **Chicken Street - O'Parinor** (chaîne Chicken Street, actif), et il n'a **aucun** mapping Deliveroo aujourd'hui.
- Les commandes non rattachées actuellement en base :
  - `CHICKEN STREET - Aulnay Oparinor 🌯` — 179 commandes, 4 184,45 €
  - `Bangkok Factory - Melun` — 142 commandes, 3 906,80 €
  - `Bangkok Factory Saint-Maximin` — 39 commandes, 1 024,60 €

## Ce qui sera fait

1. Ajouter le mapping `CHICKEN STREET - Aulnay Oparinor 🌯` → Chicken Street - O'Parinor dans `restaurant_deliveroo_ids` (le nom exact du CSV, emoji inclus ; la normalisation d'ingestion supprime déjà les caractères spéciaux, donc le rattachement fonctionnera dans les deux sens).
2. Rattacher rétroactivement les 179 lignes déjà importées dans `deliveroo_sales_orders` : renseigner `restaurant_id` et `chain_id` (Chicken Street) pour ce nom de boutique.
3. Laisser **Bangkok Factory** (Melun, Saint-Maximin) non rattaché — autre marque, exclu volontairement.

## Résultat attendu

Le CA Deliveroo d'O'Parinor (~4,1 k€ sur la quinzaine importée) remonte dans la répartition réseau, le mix canaux et le comparatif restaurants. Les imports Deliveroo suivants rattacheront ce magasin automatiquement.

## Détails techniques

- Une insertion dans `restaurant_deliveroo_ids` (nom boutique + restaurant_id) puis un `UPDATE` ciblé sur `deliveroo_sales_orders` filtré par `normalized_name`.
- Aucun changement de schéma ni de code front nécessaire.
