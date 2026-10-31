# Roadmap — Données clients Chataigne (5 chantiers)

## Éco-contribution — contrôle historique
- [x] Contre-vérification 31/10 : recette Angers sur stockage actuel inchangée (1 226,46 / 1 108,38 / 379,05 €, 62 lignes, zéro doublon Angers) ; 2 992 paires vérifiées par même hash, colonnes positionnelles et ligne CSV physique ; trois exemples et clés livrés. Écart 02/02 de −54,54 € expliqué par publicité du 31/01 et 01/02 ; jalon 1 complet et lot actuel identiques. Aucun lancement réseau.
- [x] Documenter anomalies CS/TC Argenteuil : couverture 2026 sans trous et mappings confirmés, absence de libellés éco explicites ; cause financière réelle non établie, pas de conclusion de non-facturation.
- [ ] Paris 18 : cinq fenêtres retentées avec 95 secondes entre demandes après refus ; cinq nouveaux 429 Uber, aucun accepté. Bloqué par limitation Uber, aucun traitement automatique après le tour.
- [ ] Certifier les 166 candidats : périodes documentées absentes et audits historiques sans clés communes ; besoin des justificatifs de période/éligibilité/tarif et appariements, sans exporter leur solde hors classeur.
- [ ] Durcir la règle générale de doublons avant extension : SQL value-only trop large ; les paires du lot sont contre-vérifiées, mais de nouveaux formats exigent preuve par champs nommés et provenance.
- [x] Rapprochement strict en centimes, piste d'audit préservée, 44 tests réussis ; double rejeu réel inchangé. 2 992 représentations doubles liées à leur source canonique, jamais supprimées ; aucune promotion.
- [x] Lot 10 provisoire livré : matrice par famille/signe, publicité 2 419 339 centimes sur 137/381 versements comparables (36,0 %), 351 groupes à vérifier et 166 lignes éco candidates listées. Sources disponibles, non certification comptable.
- [ ] Finaliser couverture lot : 94/99 demandes reçues ; cinq fenêtres Paris 18 bloquées par limite Uber. Créances par restaurant non certifiables sans périodes/volumes/appairages sources ; Angers 02/02 source actuelle −412,97 € contre ancien −233,21 €, version antérieure −358,43 € restant à vérifier (54,54 €).
- [x] Correction 31/10 : deux candidats 2025 présents avec recouvrement ; tests Cergy 1008 × 0,1363 = 137,39 € et fin 2025 555 × 0,1381 = 76,65 €, 41 tests ciblés réussis.
- [x] Jalon 1 élargi Angers : 18 rapports 01/12/2025–31/10/2026 reçus ; 464 lignes/464 clés ; 12 prélèvements 1 226,46 €, 10 remboursements 1 108,38 €, net −118,08 € ; famille source autres paiements 379,05 € sur dates de lignes 01/01–30/10, hors publicité/marketing/TVA explicite/saisie-arrêt. Deux réimports mars inchangés ; vue par famille vérifiée avec utilisateur autorisé.
- [ ] Validation indépendante jalon 1 : attend contre-vérification utilisateur/PDF original ; périodes/volumes repris du document fourni, pas certifiés par la seule concordance des montants. Aucun versement promu.
- [ ] Jalon 2 certification : contrôle provisoire produit sur demande Build explicite ; attend couverture complète, explication de la version −358,43 € et validation documentaire Angers. Aucun lancement réseau.
- [ ] Jalon 3 : réseau après jalons 1/2 ; bascule observée et tableau certifié par enseigne, sans préparer de réclamation avant certification.
- [x] Transition non destructive : lignes brutes parallèles, promotion service-only avec preuve de source complète, agrégats superseded conservés, vue mixte et rapprochement signé bidirectionnel ; 45 lignes Angers réimportées deux fois, anciens chiffres et vue effective inchangés.
- [ ] Livrable a : matrice par famille Angers et preuves 22 mouvements produites sur collecte complète ; attend contre-vérification utilisateur/PDF original avant certification indépendante.
- [ ] Livrable b : lot test explicite de 10 restaurants sur 2026, concordances/écarts/manquants et causes — attend validation a, ordre strict utilisateur.
- [ ] Livrable c : réseau complet uniquement après validation a/b ; recette Angers, bascule et consolidation certifiée — attend a/b.
- [x] Identité des lignes : deux réimports réels Angers, 28 mouvements, zéro doublon, somme contrôlée −704,43 € identique ; anciens groupes archivés.
- [x] Barèmes candidats à fenêtres recouvrantes et audit séparé (0,01 €, 5 €, volume ±10 %) ; voisins monotones, « à confirmer » hors bascule, appariement par période documentée ; 27 tests et contrôles réels 401/403 réussis.
- [x] Vérifier l'accès API ancien sur Angers 2026/2025/2024 ; rapports reçus. Réimport 2024 deux fois : 37 lignes, zéro doublon, total −1 192,72 € inchangé ; groupes indivisibles dans les lots.
- [ ] Ré-ingestion massive et recette réseau : attend validation indépendante Angers et lot 10 ; groupes discordants conservés sans promotion, périodes de cotisation non documentées indépendamment.
- [ ] Bascule observée et EN ATTENTE rapproché : aucune observation de période suffisante sur Angers ; ne pas présenter zéro contradiction sur zéro observation comme validation.
- [x] Contrôler les 6 816 lignes historiques « Autres frais » : 2 113 exclues vers autres frais à vérifier, 4 703 candidates conservées ; montants et classement original préservés pour audit, aucune correspondance présentée comme preuve.
- [x] Vérifier les montants inchangés (zéro écart), 13 tests réussis et page connectée Chicken Street 2026 (23 244,43 € / 24 627,89 €, 691 lignes).
- [ ] Certifier le tarif, le traitement HT/TTC et les lignes restantes : justificatif Uber identifiant la période et le nombre réel de commandes nécessaire ; les multiples seuls ne suffisent pas.

## Notes Uber — automatisation et deux périodes
- [x] Afficher séparément la moyenne 90 jours et les avis de la période sélectionnée dans la synthèse et le comparatif ; août vérifié en session sans changement de la note 90 jours.
- [x] Corriger les erreurs d’import masquées, les doublons de file et de planification ; collecte quotidienne unique à 05:00 UTC, notifications signées vérifiées ; 327 demandes de rattrapage Chicken Street août–octobre lancées, 15 terminées au contrôle.
- [x] Vérifier les calculs pondérés et le parcours connecté ; affichage explicitement reconstruit, aucune garantie d’équivalence à la note publique.
- [ ] Confirmer la concordance avec les cinq notes publiques après réception des rapports Uber : attente du traitement asynchrone des 312 demandes restantes et des avis récents indisponibles avant J-2.

## Titres restaurant — vue annuelle
- [x] Consolider les commandes en résumés calendaires Paris, préserver les corrections historiques par deltas transactionnels ; vue 2026 connectée vérifiée (1 689 418 €), agrégation réseau ~106 ms, 3 786 jours/émetteurs Place de Clichy sans écart avec les commandes, quatre tests réussis.

## Comparaison N-1 Vue d'ensemble
- [x] Verrouiller les journées isolées et périodes glissantes ; mois/année à date sur jours clos, comparaison Uber/Deliveroo par canal ; dix tests réussis, Hier bloqué, octobre arrêté au 28, toggle et septembre Uber (+22,3 % Colombes) vérifiés en session connectée, colonne Deliveroo confirmée.

## Dépenses publicitaires — consolidation
- [x] Vérifier et corriger le rattachement des frais publicitaires à la semaine réglée, sans modifier le backfill J-14 / J-8 ; assertions SQL de dates exécutées dans la migration.
- [x] Afficher un indicateur de consolidation sur la vignette, les analyses réseau et restaurant ; 14 tests réussis et parcours connecté vérifié (ratio observé 1,60 %, toujours provisoire).

## Réception webhooks Splash
- [x] Améliorer le bilan : mois courant/réseau complet par défaut, synthèse produits puis fiches restaurant ; PDF 5 pages et Excel 9 onglets téléchargés en session connectée, 14 tests réussis.
- [x] Relier la station d’O’Parinor confirmée par Splash : 78 événements rattachés, 17 ruptures (8 en cours, 9 résolues), zéro durée négative et historique connecté vérifié.
- [x] Rapports ruptures réseau et restaurant : période indépendante, aperçu visuel, PDF 2 pages et Excel 5 onglets ; téléchargements réseau/Juvisy vérifiés en session connectée, 10 tests réussis, durées bornées et limites de couverture explicites.
- [x] Historique ruptures : sélection locale par restaurant, classement par produits/ruptures/durée, filtres catégorie et tri du détail ; quatre tests réussis, Juvisy (6 ruptures), filtre en cours et retour réseau vérifiés en session connectée.
- [x] Relier les stations confirmées de Juvisy et Le Mans ; 66 événements rattachés chronologiquement, 6 ruptures Juvisy et 11 Le Mans visibles dans l’historique connecté.
- [x] Implémenter la vérification de signature, le challenge et la réception idempotente selon le guide Splash (18 tests réussis).
- [x] Déployer splash-webhook ; vérifier en ligne les rejets 401/405 et l'inbox inaccessible aux utilisateurs ; aucun événement de test enregistré.
- [ ] Valider le challenge et un événement réel avec Splash : attend l'activation par Splash sur l'URL splash-webhook déjà communiquée (disponibilités uniquement sur l'URL sans suffixe). Les notifications sont conservées sans modifier les grilles tarifaires ; accès catalogue et mapping produits restent nécessaires pour les tarifs automatiques.

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
- [ ] Archive splash_ticket_raw (plus aucune écriture depuis le 05/10) — renommage refusé par l'outil (changement cassant) : export froid puis suppression, sur feu vert utilisateur
- [ ] Pré-agrégation journalière ventes/versements Uber, Deliveroo, temps de prépa (correctif de fond lenteurs Vue d'ensemble)

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
