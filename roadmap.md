# Roadmap — Données clients Chataigne (5 chantiers)

## Prix & Tarifs
- [x] Ajouter la saisie par restaurant et par canal (Uber Eats, Deliveroo, Dishop, Châtaigne) avec comparatif caisse et médianes réseau.
- [x] Permettre l'import Excel ciblé sur un ou plusieurs canaux, avec aperçu des restaurants reconnus avant confirmation.

## Identité des enseignes
- [x] N'afficher le nom de l'enseigne qu'une fois, dans le sélecteur de chaîne, avec son logo lorsqu'il est configuré.

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

## Nettoyage navigation (imports)
- [x] Supprimer « Saisie de données » (pages saisie/revenus/conversion/frais + liens).
- [x] Supprimer « Checklist Imports » (page + route + entrée de menu) — plus de sens depuis les API.
- [ ] Remplacer la checklist par un écran adapté aux rapports : suivi de ce qui est à jour / en retard par rapport (Uber, Deliveroo, caisse, Dishop, Chataigne), et réintroduire les imports ponctuels le jour où d'autres sources que les API arrivent.
- [x] Supprimer « Marketing Analytics » (entrée de menu, route `/marketing-analytics`, page, composants `components/marketing/`, hooks `useMarketingCampaigns` / `useOfferProfitability` / `useOfferMatchedOrders`). L'import « Campagnes Marketing » dans Import Rapports est conservé.

## Nettoyage navigation (suite)
- [x] Supprimer « Catalogue Produits » (`/menu-items`) et « Historique Modifs » (`/menu-history`) — les données restent en base et alimentent « Prix & Tarifs ».
- [ ] Refaire l'écran « Rapports hebdo » à zéro (version actuelle écartée par l'utilisateur, « les débuts »). Le moteur d'envoi WhatsApp et les liens partagés `/r/wr/:token` restent en place.
- [x] Supprimer « Rapports hebdo » (menu + page /reports/weekly) — à refaire à zéro plus tard ; liens publics /r/wr/:token conservés
- [x] Supprimer « Actions & Events » (/actions) et « Opérations » (/operations) du Pilotage — section Pilotage retirée ; « Opérations » d'Analytics conservée

## Optimisation base (Phase 1 lancée 05/10/2026)
- [ ] Contrôle après 1re nuit : lignes caisse_ticket_lines du jour présentes, page Live OK, plus aucune écriture dans splash_ticket_raw (dernière : 05/10 08:10 UTC). Sinon rollback.
- [ ] Désactiver uber-backfill-worker-cron et splash-ticket-backfill-tick une fois leurs files vides (608 / 80 en attente au 05/10)
- [ ] Export mensuel puis suppression de splash_ticket_raw — bloqué : confirmation sauvegarde par l'utilisateur

## Correction totaux journaliers Châtaigne
- [x] Corriger la synchro sur des journées complètes Paris.
- [x] Recalculer l’historique Chicken Street et contrôler les totaux.
- [x] Vérifier Angers et Argenteuil dans Performance par restaurant.

## Tableau Performance par restaurant
- [x] Ajouter les neuf colonnes demandées, la recherche et le tri avec agrégation serveur cohérente.
- [x] Vérifier le tableau en session connectée : neuf colonnes, recherche Angers/Argenteuil et tri CA TTC.

## Repères Châtaigne partagés
- [x] Afficher les titres et dates sans survol, avec un contrôle simple pour masquer ou afficher les repères sur les courbes Châtaigne ; affichage, masquage et édition vérifiés en session connectée.
- [x] Relier l’évolution CA/commandes aux repères partagés du Parrainage et de Croissance & Clients.
- [x] Vérifier la visibilité réciproque, les granularités et la modification des repères.
- [x] Ajouter les plages datées partagées et la sélection par glissement ; création, partage vers Parrainage, modification réciproque et suppression vérifiés en session connectée.

## Mijo (Claude Sonnet 5.5)
- [x] Lire les trois erreurs HTTP 400 : essais avec thinking disabled ; trois nouvelles questions réussies, zéro 400, modale du journal vérifiée.
- [x] Corriger l'ouverture des conversations et vérifier le rechargement du fil en session connectée (clic titre ouvre, double-clic renomme).
- [x] Garantir 12 messages maximum côté serveur ; quatre tests réussis et suivi « et pour Cergy ? » vérifié sur un ancien échange.
- [x] Générer les titres Haiku hors quota ; titre visible, status title, 240 tokens, 0,000035 $, zéro outil ; quota +1 uniquement pour la réponse.
- [x] Tables quotas + journal d'usage, incrément atomique réservé au serveur
- [x] Fonction réécrite : deux clients, quota fail-closed, cache stable, page + KPIs hors cache
- [x] Compteur « X / 500 questions ce mois » + bannière à 80 %
- [x] Activer Mijo : appels Claude réels et journalisation vérifiés.

## Performance restaurant multi-canal
- [x] Page /restaurants/:id/performance (Voir réseau + liste Restaurants), semaines partielles signalées

## Import Uber Eats réseau
- [x] Améliorer la reconnaissance automatique des variantes Uber : pauses et événements identifiés sans mauvais routage, disponibilité horaire reconnue par contenu, métadonnées FR/EN ; 28 tests et dépôt/aperçu connectés vérifiés sur exemples synthétiques.
- [x] Corriger l’isolation de l’historique et reconstituer huit familles Bangkok septembre depuis les données vérifiées ; matrice et changement d’enseigne testés en session connectée.
- [x] Refaire le dépôt réseau avec détection, file de fichiers et périmètre restaurant optionnel.
- [x] Réutiliser la validation et les imports existants avec historique enrichi.
- [x] Tester la détection des 14 familles (19 tests) et la validation connectée du CSV avis Bangkok Factory (35 restaurants).
- [ ] Valider les écritures de chaque famille en bout en bout : rapports réseau items_with_errors et store_availability non pris en charge ; pas de réimport destructif des avis pour le test.
