# Rentabilité Deliveroo — Publicités puis Produits vendus

Validé : les deux ingestions suivent exactement le pattern `ingest-deliveroo-orders` (clé partagée `DELIVEROO_INGEST_KEY` via `x-api-key`, ou JWT utilisateur pour l'import manuel depuis l'UI), rapprochement par nom via `restaurant_deliveroo_ids` et la même normalisation de nom.

## Étape 1 — Publicités (quick win)

Table `deliveroo_ads` : `id, date, chain_id, restaurant_id (nullable), deliveroo_name, campaign_id, campaign_name, campaign_status, ad_spend, ad_sales_clicks, ad_orders_clicks, clicks, views, avg_cpc, source_file, imported_at`.
- Unicité `(deliveroo_name, campaign_id, date)` → upsert idempotent.
- GRANT + RLS : lecture pour les utilisateurs ayant accès à la marque (`user_has_chain_access(chain_id)`), écriture réservée au service (edge function).

Edge function `ingest-deliveroo-ads` : reçoit `{ csvContent, fileName, dryRun }`, parse les colonnes du fichier fourni, résout `restaurant_id`/`chain_id` par nom normalisé, renvoie un récap (lignes lues, insérées/mises à jour, noms non rapprochés). Les restos absents du rapport (pas de pub) ne sont pas une erreur.

Restitution immédiate : onglet d'import Deliveroo « Publicités » (même UI que les commandes) + indicateur **% pub Deliveroo** (`SUM(ad_spend) / CA`) et **ROAS** (`ad_sales_clicks / ad_spend`) par restaurant.

## Étape 2 — Produits vendus

Table `deliveroo_product_sales` : `period_start, period_end, chain_id, restaurant_id, deliveroo_name, category, product_name, normalized_product, quantity, subtotal, source_file, imported_at`, unicité `(deliveroo_name, product_name, period_start, period_end)`.

Edge function `ingest-deliveroo-products` : reçoit `{ csvContent, fileName, periodStart, periodEnd, dryRun }` (le rapport n'a pas de date par ligne, les bornes viennent du collecteur).

## Étape 3 — Matching produit → food cost

Table `deliveroo_product_map (normalized_product unique par chain_id, menu_item_id ou food_cost)`. Rapprochement automatique par nom normalisé (sans emoji/accents/casse) contre `menu_items`, puis écran de matching manuel pour les produits non rapprochés (même esprit que `/deliveroo-matching`).

## Étape 4 — Rentabilité

RPC `get_deliveroo_profitability(p_start, p_end, p_restaurant_ids)` agrégeant **chaque source séparément** puis jointure sur `restaurant_id` (pas de JOIN ligne-à-ligne, anti fan-out) : CA + commission depuis `deliveroo_sales_orders` (statut Terminée), pub depuis `deliveroo_ads`, food cost depuis `deliveroo_product_sales × deliveroo_product_map`.
Sortie : `ca, commission, pub, food_cost, marge, marge_pct`. Écran par restaurant + total réseau, filtres période/resto, dans l'esprit de la page « Rentabilité Livraison ».

## Notes techniques
- Dates agrégées en Europe/Paris, isolation stricte par `chain_id`, RPC en `SECURITY DEFINER` avec `SET search_path = public`.
- Une seule clé `DELIVEROO_INGEST_KEY` réutilisée pour les 3 endpoints (URLs à transmettre au collecteur une fois déployés).

Livraison en 4 lots ; l'étape 1 est livrée et testable en premier avec le fichier d'exemple.
