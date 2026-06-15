## Objectif

Générer un ZIP contenant **1 CSV par table alimentée par l'API Uber Eats**, filtré sur :
- Restaurant : **Chicken Street - Argenteuil** (`d69579a6-987a-4d42-9937-bcb6c8373155`)
- Période : **1er → 31 mai 2026**

Livraison sous forme d'artefact `presentation-artifact` dans `/mnt/documents/`.

## Rappel : ce que l'API Uber nous donne aujourd'hui

L'API Uber Eats expose 8 types de rapports CSV (générés via `uber-create-report` puis ingérés via les fonctions `parse-*`). Voici la cartographie complète des tables alimentées :

| # | Table | Source Uber | Granularité |
|---|---|---|---|
| 1 | `orders` (83 col.) | Payment Details Report | 1 ligne / commande |
| 2 | `order_items` (41 col.) | Order History Report (items) | 1 ligne / item commandé |
| 3 | `order_history` (31 col.) | Order History Report (header) | 1 ligne / commande |
| 4 | `payouts` (56 col.) | Payment Details (paiements hebdo) | 1 ligne / payout |
| 5 | `payout_adjustments` (11 col.) | Payment Details (ajustements) | 1 ligne / ajustement |
| 6 | `daily_sales_uber` (10 col.) | Sales Over Time Report | 1 ligne / jour |
| 7 | `daily_conversion` (15 col.) | Marketplace Funnel Report | 1 ligne / jour |
| 8 | `monthly_conversion` (15 col.) | Marketplace Funnel (mensuel) | 1 ligne / mois |
| 9 | `daily_order_accuracy` (16 col.) | Order Errors Report (agrégé) | 1 ligne / jour |
| 10 | `monthly_order_accuracy` (17 col.) | Order Errors (mensuel) | 1 ligne / mois |
| 11 | `order_errors` (17 col.) | Order Errors (détail) | 1 ligne / erreur |
| 12 | `downtime_logs` (8 col.) | Downtime Report | 1 ligne / coupure |
| 13 | `hourly_availability` (8 col.) | Downtime (dispo horaire) | 1 ligne / heure |
| 14 | `delivery_stats` (14 col.) | Delivery Performance Report | 1 ligne / jour |
| 15 | `customer_reviews` (18 col.) | Customer Reviews Report | 1 ligne / avis |
| 16 | `menu_item_reviews` (15 col.) | Menu Item Reviews (thumbs) | 1 ligne / item-avis |
| 17 | `product_issues_ranking` (12 col.) | Product Issues Report | 1 ligne / item |
| 18 | `monthly_fees` (17 col.) | Payment Details (frais mensuels) | 1 ligne / mois |
| 19 | `eco_line_snapshots` (6 col.) | Payment Details (éco-contrib.) | 1 ligne / ligne éco |

## Étapes d'exécution (mode build)

1. **Script Python** (`/tmp/export_uber_argenteuil.py`) qui :
   - Se connecte via `psql` (env `PG*` déjà set)
   - Pour chaque table ci-dessus, `COPY (SELECT * FROM <table> WHERE restaurant_id = '<uuid>' AND <date_col> BETWEEN '2026-05-01' AND '2026-05-31') TO STDOUT WITH CSV HEADER`
   - Adapte la colonne de date par table (`order_time` pour `orders`, `business_date` pour `daily_*`, `payout_date` pour `payouts`, etc.)
   - Pour `order_items` : join via `orders.id` puisque pas de date directe
   - Écrit chaque CSV dans `/tmp/uber_argenteuil_mai2026/`

2. **Compression** : `zip -r /mnt/documents/uber_argenteuil_mai2026.zip` du dossier + un fichier `README.txt` listant les 19 tables, leur source Uber et le nombre de lignes exportées.

3. **Restitution** :
   - Affichage d'un récap chiffré (lignes par table)
   - Balise `<presentation-artifact path="uber_argenteuil_mai2026.zip" mime_type="application/zip">` pour téléchargement

## Note technique

Si une table est vide pour la période/restaurant, le CSV est généré quand même avec uniquement la ligne d'en-têtes (utile pour visualiser le schéma exact que l'API Uber alimente). Le `README.txt` signalera les tables vides.

Pas de modification du code applicatif, pas de migration : c'est un export ponctuel.