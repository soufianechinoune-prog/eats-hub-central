# Roadmap — Données clients Chataigne (5 chantiers)

Base : nouvelle clé API avec permission `customers` (endpoint `/v1/organizations/busorg_fJF9DesU33/customers` avec `include=orders`).

## Étape 0 — Sonde de structure ✅
- Sonde `chataigne-probe-customers` : endpoint org `/v1/organizations/busorg_fJF9DesU33/customers` → 200, pagination (`object/data/has_more`), `completed_orders_count`, `marketing_consent` (opted_in/out + changed_at), commandes imbriquées complètes (items, discounts, fees, subtotal/total, status, short_id). PII masquées dans la sonde.

## Étape 1 — Segmentation CRM & Rétention (Matrice RFM) ✅
- RPC `get_chataigne_rfm(p_start, p_end, p_restaurant_ids)` (SECURITY DEFINER, `statement_timeout=30s`, agrégation anti-fan-out en un passage).
- Écran `/chataigne/clients` « Clients & Segments » (KPIs, répartition segments Clients/CA, tableau détaillé, top 40 clients pseudonymisés). Période par défaut : 30 derniers jours arrêtés à la veille.
- Récence / Fréquence / Montant par client (code_client haché, 100 % anonyme).
- Segments : Champions, Fidèles, À risque, Dormants, Nouveaux…
- Table `chataigne_customers` (snapshot sync) + RPC d'agrégation + écran dans Chataigne.

## Étape 2 — Consentement marketing & Campagnes WhatsApp
- Exploiter les champs de consentement si disponibles dans l'API (opt-in/out marketing).
- Ciblage des campagnes WhatsApp existantes par segment RFM.
- Vue pilotage : taille des audiences, exclusions (rétractation, inactifs).

## Étape 3 — Parrainage avancé & LTV
- Brancher la vraie LTV par filleul (cohortes d'acquisition, CA cumulé post-acquisition).
- Croiser filleuls ↔ clients API (récurrence, panier, fréquence post-acquisition).

## Étape 4 — Mobilité inter-restaurants (Cross-Store)
- Détecter les clients qui commandent dans plusieurs restaurants du réseau.
- Matrice de flux entre restaurants, part des multi-sites.

## Étape 5 — Optimisation technique de la synchronisation
- Pipeline sync customers/orders : pagination, rate limits, incrémental (updated_at), anti-fan-out.
- Tables : `chataigne_customers`, `chataigne_customer_orders` (agrégée, jamais ligne-à-ligne en UI).

Règles transverses : code_client haché (CHATAIGNE_HASH_SALT), isolation chain_id via `user_has_chain_access`, agrégation SQL côté serveur, jamais de PII en base ni à l'écran.
