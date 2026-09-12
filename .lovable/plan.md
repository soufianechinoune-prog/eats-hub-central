# Emport vs Livraison (canal Chataigne)

Nouvel onglet « Emport vs Livraison » sur la page Chataigne, avec les mêmes filtres (réseau/restaurant + période) et le même style que les autres pages Analytics.

## Étape 1 — Les deux vues décisionnelles

### Vue 1 · Rentabilité comparée (vue clé)
Un graphique en barres groupées comparant le taux d'encaissement :
- Emport avec promo / Emport sans promo
- Livraison avec promo / Livraison sans promo

Taux = argent réellement encaissé ÷ valeur des mêmes produits au prix pratiqué en boutique.
Encaissé = montant de la commande − 1 € (Chataigne) − frais de paiement (0,25 € + 1,5 %) − 3 € de livraison quand la commande est livrée.
« Avec promo » = commandes portant une remise (surtout le bon de bienvenue).

Sous le graphique : une ligne de lecture chiffrée (nombre de commandes derrière chaque barre) et une mention quand la couverture des prix boutique est partielle, pour éviter de lire un taux calculé sur trop peu de commandes.

### Vue 4 · KPIs côte à côte
Deux blocs (Emport / Livraison) : nombre de commandes, part du total, chiffre d'affaires, panier moyen.

## Étape 2 (ensuite, même onglet)
- Évolution du mix emport/livraison, avec la bascule jour/semaine/mois comme les autres graphes.
- Panier moyen emport vs livraison dans le temps.

## Détails techniques

Nouvelle fonction base de données `get_chataigne_service_comparison(p_start, p_end, p_restaurant_ids)` :
- `SECURITY DEFINER`, `SET search_path = public`, `statement_timeout` 30s, isolation par `chain_id` via `is_super_admin() OR user_has_chain_access()`, `GRANT EXECUTE` à `authenticated` uniquement (`anon` révoqué).
- Anti-fan-out : agrégation des commandes (`chataigne_orders`) d'un côté et des lignes (`chataigne_order_items` × `chataigne_item_instore_ref`, `depth = 0`, `item_type in ('product','bundle')`, prix > 0) dans un CTE séparé pré-agrégé par commande, puis composition par `service_type` × présence de promo. Jamais de jointure ligne-à-ligne avant agrégation.
- Sortie : une ligne par (`service_type`, `has_promo`) avec `orders`, `revenue`, `avg_basket`, `net_collected`, `instore_ref`, `collection_rate`, `orders_with_ref`.
- Dates filtrées sur `order_datetime` sans reconversion de fuseau.

Front :
- Hook `useChataigneServiceComparison` dans `src/hooks/useChataigne.ts` (même pattern `scopeKey` / `enabled` que les hooks existants).
- Composant `src/components/chataigne/ChataigneServiceComparison.tsx` (Recharts + `KPICard`, tokens de couleur existants).
- Branchement comme nouvel onglet `?tab=service` dans `src/pages/Chataigne.tsx`, réutilisant `selectedRestaurants` / période du contexte Analytics.

Les vues 2-3 réutiliseront la même fonction avec un paramètre de granularité (`p_bucket`) ou une seconde fonction dédiée, selon ce qui reste le plus lisible.
