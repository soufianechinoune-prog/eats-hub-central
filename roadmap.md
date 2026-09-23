# Roadmap — Données clients Chataigne (5 chantiers)

Base : nouvelle clé API avec permission `customers` (endpoint `/v1/organizations/busorg_fJF9DesU33/customers` avec `include=orders`).

## Étape 0 — Sonde de structure ✅ en cours
- Sonde `chataigne-probe-customers` : inspecter le schéma réel (customers + orders imbriquées), pagination, champs disponibles. PII masquées.

## Étape 1 — Segmentation CRM & Rétention (Matrice RFM)
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
