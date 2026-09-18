# Caisse — vues opérationnelles & paiement

Je suis d'accord avec le plan, avec une réserve importante sur le pré-requis.

## Point de vigilance : l'ingestion ticket par ticket n'existe pas encore

La spec suppose que le détail ticket est « déjà en cours d'ingestion ». Vérification faite : ce n'est pas le cas aujourd'hui.

- Ce qui est stocké côté caisse : le CA journalier par restaurant (agrégat) et un récapitulatif produit par mois.
- L'import produit lit bien le détail commande depuis Splash, mais **jette** au passage tout ce dont les nouvelles vues ont besoin : moyen de paiement et sa marque, catégorie du produit, type de service (sur place / emporter / livraison), heure précise du ticket.

Conséquence : on ne peut pas construire « Moyens de paiement » ni le taux d'attachement avant d'avoir conservé ces informations. C'est donc l'étape 1.

## Étapes

### 1. Conserver le détail ticket (pré-requis)
- **Codes d'accès par restaurant** : les accès actuels sont enregistrés au niveau enseigne (2 lignes) alors qu'on dispose de 182 couples au niveau restaurant / caisse. Création d'une table dédiée aux accès par restaurant (identifiant + secret chiffré), lisible uniquement par le service (jamais par un utilisateur connecté ni par un visiteur), alimentée par un import contrôlé des deux fichiers Excel reçus de Splash. L'import ne journalise jamais les secrets. L'automate parcourt cette table.
- Relevé du format réel renvoyé par Splash sur un restaurant témoin, pour figer les noms de champs (paiement, marque titres-resto, catégorie, service, horodatage, montants).
- Deux nouvelles tables : un ticket (restaurant, marque, date-heure, type de service, moyen de paiement + marque, total en euros) et ses lignes (produit, référence, catégorie, quantité, prix, niveau article / sous-produit de menu / option).
- Nouvel import dédié, par restaurant et par période, relançable sans créer de doublons, avec suivi des exécutions comme les autres connecteurs.
- **Rattrapage progressif** : 182 accès × ~2 ans, donc jamais tout d'un coup. File de travaux en priorité basse, découpée par restaurant et par mois, avec délai entre appels, respect des limites de Splash, arrêt et reprise automatiques en cas de blocage. Démarrage : un seul restaurant témoin sur un mois, contrôle des chiffres, puis élargissement progressif restaurant par restaurant.
- Normalisation des libellés de paiement à l'entrée : Carte, Espèces, Titres-resto (+ marque), Autre. Table de correspondance modifiable, tout libellé inconnu tombe en « Autre » et reste visible pour être qualifié.
- Montants convertis en euros, horodatage conservé tel quel (heure locale du restaurant).
- Règle anti-double-comptage : le CA sur place continue de venir de l'agrégat journalier tant que l'historique ticket n'est pas complet ; un indicateur de couverture par restaurant / mois dit quand basculer. Jamais les deux sources additionnées.


### 2. Ventes par produit
Best-sellers : produit, catégorie, quantité, CA, part du CA. Triable, regroupable par catégorie.
Taux d'attachement : part des tickets contenant une Boisson, un Side, une Sauce (d'après la catégorie des lignes), par restaurant et pour le réseau, avec classement des restaurants pour identifier le levier « pousser la boisson ».
Marge par produit : hors périmètre, plus tard.

### 3. Moyens de paiement
Répartition Carte / Espèces / Titres-resto par restaurant et son évolution dans le temps.
Part titres-resto par restaurant, détail par marque (Swile, Pluxee, Edenred, Up…), exportable pour alimenter l'audit titres-resto.
Bloc « libellés non reconnus » pour ne rien perdre en silence.

### 4. Synthèse enrichie
Ajout sur la vue Synthèse existante : CA sur place, nombre de tickets, panier moyen par ticket, répartition paiement, split sur place / à emporter, heure de pointe, top 5 produits. Les blocs alimentés par le ticket n'apparaissent que sur les restaurants et périodes couverts.

### 5. Tickets & horaires
Heatmap heure × jour, midi vs soir, distribution du panier. Après validation des étapes précédentes.

## Design
Aucune nouveauté visuelle : mêmes cartes, mêmes graphiques, mêmes filtres période / restaurants que les canaux Uber, Deliveroo et Chataigne, et les nouveaux sous-onglets se branchent dans la barre de droite du canal Caisse déjà en place (« Ventes par produit » remplace la coquille « bientôt »).

## Détails techniques
- Tables `splash_tickets` / `splash_ticket_lines` : clés naturelles (restaurant + id ticket Splash) pour un import idempotent, `chain_id` porté sur les deux tables, triggers de cohérence de marque comme sur les tables Splash existantes, GRANT `authenticated` + `service_role`, RLS via `user_has_chain_access`, `anon` révoqué. Index (restaurant_id, ticket_datetime) et (ticket_id) pour les lignes.
- Edge function `splash-orders-sync` : OAuth `client_credentials` sur `api2.splash360.fr`, credentials lus dans `chain_pos_connections`, pagination `pageSize=100`, table de runs + reprise par jour.
- RPC `get_caisse_overview`, `get_caisse_product_sales`, `get_caisse_payment_breakdown`, `get_caisse_hourly` : `SECURITY DEFINER`, `SET search_path = public`, garde `is_super_admin() OR user_has_chain_access(chain_id)`, anti-fan-out strict — CTE tickets agrégée d'un côté, CTE lignes pré-agrégée par ticket de l'autre, composition seulement après agrégation. Le taux d'attachement se calcule sur `count(distinct ticket_id)` issu d'une CTE de flags par ticket, jamais sur un join ligne à ligne.
- Front : pages sous le canal Caisse, hooks React Query, respect du filtre période global d'`AnalyticsContext` et de `useActiveRestaurants()`.

## Ordre de livraison proposé
Étape 1 (relevé du format + tables + import + normalisation paiement), puis étape 3 (Moyens de paiement, la plus rapide dès le ticket disponible), puis étape 2, puis la Synthèse enrichie.
