# Roadmap — Données clients Chataigne (5 chantiers)

## Rattachements Tasty Crousty
- [x] Valider et rattacher les 14 points de vente confirmés par l'utilisateur (Marseille ×4, Toulouse ×2, Bordeaux ×2, Rennes Ville Jean, Villeurbanne, Paris ×2, Créteil, Mantes).
- [x] Créer inactifs les sept restaurants non encore ouverts et Créteil Soleil, puis rattacher leurs points de vente Chataigne respectifs. Créteil 2 reste distinct (dark kitchen).
- [x] Rattacher Rennes Colombier (rue d’Isly) à la fiche Rennes Isly ; Rennes Ville Jean reste sur Tasty Crousty Rennes.
- [ ] Confirmer si les historiques Uber « Colombier » et caisse « Rennes Isly » doivent être réunis dans une seule fiche avant toute fusion de données.
- [x] Synchros Chataigne multi-enseignes : commandes + clients Tasty Crousty (148 clients, 139 opt-in) et crons quotidiens dédiés (commandes 03:25 UTC, clients 04:30 UTC).
- [ ] Vérifier si la permission analytics existe sur la clé Tasty Crousty (refusée côté Chicken Street) avant d'ajouter un cron analytics.


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

## Étape 3 — Parrainage avancé & LTV ✅
- RPC `get_chataigne_referral_ltv(p_start, p_end, p_restaurant_ids)` (SECURITY DEFINER, anti-fan-out, TZ Paris) : cohortes mensuelles filleul / bienvenue / organique, CA et contribution cumulés par client, CAC de la cohorte, recul observé.
- Bloc « Valeur cumulée par filleul » dans `/chataigne/parrainage` : courbes par cohorte + moyenne autres clients, ligne CAC moyen, tableau valeur/coût.
- Contribution = encaissé − 1 € Chataigne − frais paiement (0,25 € + 1,5 %).


## Étape 4 — Mobilité inter-restaurants (Cross-Store) ✅
- RPC `get_chataigne_cross_store(p_start, p_end, p_restaurant_ids)` (SECURITY DEFINER, anti-fan-out, TZ Paris, anon révoqué) : profils 1/2/3/4+ restaurants, paires de restaurants (clients communs), taux de partage par restaurant.
- Page `/chataigne/mobilite` « Mobilité inter-restos » : KPIs nomades (clients, CA, panier, fréquence), répartition par profil (Clients/CA), paires les plus liées, restaurants carrefours.
- Période par défaut : 90 derniers jours arrêtés à la veille.

## Étape 5 — Optimisation technique de la synchronisation ✅
- Crons quotidiens : analytics 03:00 UTC, commandes incrémentales (3 j) 03:15 UTC, clients + consentements 04:00 UTC.
- Pipeline sync customers/orders : pagination, rate limits, incrémental (updated_at), anti-fan-out.
- Tables : `chataigne_customers`, `chataigne_customer_orders` (agrégée, jamais ligne-à-ligne en UI).

Règles transverses : code_client haché (CHATAIGNE_HASH_SALT), isolation chain_id via `user_has_chain_access`, agrégation SQL côté serveur, jamais de PII en base ni à l'écran.
