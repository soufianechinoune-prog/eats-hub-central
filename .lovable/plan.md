# Caisse — tenir la charge à ~80 M de lignes

## Où on en est réellement (vérifié)

- Les vues Caisse actuelles (`get_caisse_payment_breakdown`, `get_caisse_payment_weekly`, `get_caisse_payment_brands`) lisent **les tickets et règlements bruts en direct**. Aucun rollup, aucune vue matérialisée aujourd'hui.
- Aucune table ticket n'est partitionnée (tables simples).
- Volumes actuels : 10 019 tickets, 82 934 lignes, 9 425 règlements. Tickets 46 Mo, lignes 34 Mo, règlements 3 Mo.
- Champ brut : 1 262 octets en moyenne par ticket, 12 Mo au total (déjà compressé par le stockage).

Projection à 80 M de lignes (≈ 9,5 M tickets, soit les 182 caisses × ~2 ans) :
lignes ≈ 33 Go, tickets ≈ 44 Go dont ≈ 12 Go de brut, règlements ≈ 3 Go.
À cette taille, lire les tickets en direct pour une vue réseau sur 12 mois n'est plus tenable. Donc oui : on passe aux rollups, et on partitionne maintenant, pendant que les tables sont petites.

## 1. Rollups pré-agrégés (les vues ne lisent plus le brut)

Trois tables d'agrégat, grain **restaurant × jour** (déjà le grain de tous les filtres de l'app) :

- tickets/jour : nb tickets, CA TTC/HT/TVA, split sur place / emporter / livraison, centre de revenu, panier moyen.
- règlements/jour : montants par catégorie (Carte, Espèces, Titres-resto, Plateforme, Autre) et par marque de titre-resto.
- produits/jour : par produit et catégorie — quantité, CA, nb tickets contenant le produit (pour le taux d'attachement).

Alimentation **incrémentale**, pas de rafraîchissement global : à la fin de chaque import (connecteur et worker de rattrapage), on recalcule uniquement les couples (restaurant, jour) touchés. Idempotent, donc un ré-import ne double jamais rien.

Les RPC Caisse existantes sont réécrites pour lire ces rollups. Même signature, mêmes résultats, mêmes garde-fous d'accès — le front n'est pas touché.

Le détail ticket reste consultable, mais uniquement en descente ciblée (un restaurant, une journée), jamais pour une agrégation réseau.

## 2. Partitionnement par mois

`splash_ticket_lines`, `splash_tickets` et `splash_ticket_payments` deviennent partitionnées par mois sur la date métier du ticket. Effet : une période de 3 mois ne lit que 3 partitions au lieu de la table entière, et purger ou archiver un vieux mois devient instantané.

Fait maintenant, pendant que les données tiennent en 80 Mo : recréation des tables partitionnées, recopie, bascule, contrôle des compteurs avant/après. Le rattrapage en cours est mis en pause le temps de la bascule puis reprend là où il s'était arrêté.

## 3. Index ciblés

Sur chaque partition : (restaurant, date), (chaîne, date), clé naturelle unique, et pour les lignes (catégorie, date) pour le taux d'attachement. On retire l'index de recherche dans le brut (GIN sur le champ brut), coûteux à l'écriture et inutile pour les vues — il sera recréé à la demande si une analyse le justifie.

## 4. Surveillance du brut

- Le brut reste stocké compressé et sorti du chemin de lecture des vues : il est déplacé dans une table dédiée, en relation 1:1 avec le ticket. Conséquence directe : les tables lues par les rollups et les descentes deviennent ~3× plus légères.
- Un indicateur d'occupation par mois et par enseigne, visible côté admin, pour voir la croissance réelle au lieu de l'estimer.
- Règle de purge prévue mais **non activée** : au-delà de 24 mois, le brut peut être supprimé sans toucher aux colonnes structurées ni aux rollups. À décider plus tard, quand le volume le justifie.

## Détails techniques

- Rollups : `caisse_daily_tickets`, `caisse_daily_payments`, `caisse_daily_products` (`restaurant_id`, `chain_id`, `ticket_date`, + mesures), PK naturelle par jour/dimension, `GRANT select` à `authenticated` + `all` à `service_role`, RLS `is_super_admin() OR user_has_chain_access(chain_id)`, `anon` révoqué, trigger de cohérence de marque comme sur les tables Splash.
- Fonction `refresh_caisse_rollups(p_restaurant_id uuid, p_from date, p_to date)` en `SECURITY DEFINER`, `SET search_path = public` : `delete` + `insert ... select` anti-fan-out (CTE tickets agrégée d'un côté, CTE lignes/règlements pré-agrégées par ticket de l'autre, composition après agrégation ; attachement sur `count(distinct ticket_uuid)`). Appelée par `splash-orders-sync` et `splash-ticket-backfill-worker` en fin de job sur la plage traitée.
- RPC réécrites sur les rollups : `get_caisse_payment_breakdown`, `get_caisse_payment_weekly`, `get_caisse_payment_brands` (+ futures `get_caisse_product_sales`, `get_caisse_overview`, `get_caisse_hourly`). `statement_timeout` conservé.
- Partitionnement : `PARTITION BY RANGE (ticket_date)`, partitions mensuelles créées d'avance par une fonction `ensure_caisse_partitions(p_months int)` appelée par le cron existant. Clés uniques étendues à `ticket_date` (contrainte Postgres sur table partitionnée). Les FK ligne→ticket sont remplacées par un contrôle applicatif + `ticket_date` portée sur les enfants (déjà le cas).
- Brut déporté : `splash_ticket_raw (ticket_uuid pk, restaurant_id, chain_id, ticket_date, payload jsonb)`, `GRANT service_role` seulement, aucune lecture côté client ; colonnes `raw`/`raw_payload` de `splash_tickets` supprimées après recopie et contrôle de complétude.
- Bascule : migration en une transaction par table (création partitionnée, copie, `count(*)` avant/après, renommage), worker de rattrapage suspendu puis relancé.

## Ordre de livraison

1. Rollups + réécriture des RPC (gain immédiat, sans risque sur les données).
2. Déport du brut dans sa table dédiée.
3. Partitionnement mensuel + index par partition, avec contrôle des compteurs.
4. Indicateur d'occupation ; purge du brut laissée désactivée.
