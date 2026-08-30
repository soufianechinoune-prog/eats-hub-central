# Onglet Deliveroo complet dans la Vue d'ensemble

Aujourd'hui Deliveroo existe dans la barre latérale des canaux mais n'ouvre qu'une seule carte "opérations" (note, temps de prépa, disponibilité). Uber Eats, lui, dispose d'un sous-menu complet (Synthèse, Revenus, Finances, Opérations, Avis…). On aligne Deliveroo sur ce modèle, avec les vues réellement alimentées par la donnée Deliveroo.

## Ce qu'on construit

### 1. Sous-menu Deliveroo (comme Uber Eats)
Ajout d'un sous-menu dépliable sous "Deliveroo" avec uniquement les vues pertinentes :
- Synthèse (reste sur /overview, canal Deliveroo)
- Revenus & Ventes → /analytics/revenue en mode Deliveroo
- Finances & Frais → /analytics/finances en mode Deliveroo
- Opérations → /analytics/operations
- Comparatif disponibilité → /compare/downtime

Volontairement exclus : Ventes Articles, Conversion, Offres, Score de Réussite, Éco-contribution, Avis — Deliveroo ne fournit pas ces données (pas de détail article, pas de tunnel de conversion).

### 2. Synthèse Deliveroo enrichie
La vue "Synthèse" du canal Deliveroo affiche, sur la période sélectionnée :
- Cartes KPI : CA brut, nombre de commandes, panier moyen, commission Deliveroo (€ et %), versement net
- Évolution quotidienne du CA et des commandes
- Classement des restaurants Deliveroo (CA, commandes, panier moyen, commission %)
- La carte opérationnelle actuelle (note, temps, disponibilité) conservée en dessous

### 3. Cohérence visuelle
Mêmes composants de carte, mêmes couleurs de canal (turquoise Deliveroo) et même sélecteur de période que l'onglet Uber Eats, pour une lecture identique d'un canal à l'autre.

## Détails techniques

- `OverviewChannelSidebar.tsx` : généraliser le mécanisme de sous-menu (actuellement codé en dur pour Uber) et ajouter `DELIVEROO_SUB_ITEMS`; la navigation appelle `setSelectedPlatform("deliveroo")` avant `navigate(route)`.
- Nouveau composant `src/components/overview/DeliverooChannelSummary.tsx` alimenté par une RPC d'agrégation côté serveur sur `deliveroo_sales_orders` (CA, commandes, commission, net) filtrée par `restaurant_id` et par jour en TZ Europe/Paris, plus `restaurant_deliveroo_ids` pour le rattachement.
- Nouvelle RPC `get_deliveroo_channel_summary(restaurant_ids uuid[], start_date date, end_date date)` en `SECURITY DEFINER`, `SET search_path = public`, isolée par `chain_id` — retour JSONB : totaux + série quotidienne + détail par restaurant. Pas d'agrégation côté navigateur.
- `Overview.tsx` : brancher la nouvelle synthèse sur `activeChannel === "deliveroo"` en réutilisant `activeIds`, `startDate`, `endDate`.
- Les restaurants non mappés (ex. Bangkok Factory) restent exclus puisque le rattachement passe par `restaurant_deliveroo_ids`.

## Hors périmètre
Aucune modification des imports/collecteurs Deliveroo ni des calculs existants Uber/Caisse/Chataigne.
