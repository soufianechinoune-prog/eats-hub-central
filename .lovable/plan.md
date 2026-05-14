
# Page Backfill CA Uber — Restaurant par Restaurant

## Objectif

Créer une nouvelle page `/uber-backfill-ca` qui te permet de **rattraper l'historique des commandes Uber (`ORDER_HISTORY_REPORT`)** pour les ~140 restaurants dont le CA en Overview affiche le badge "CSV" au lieu de "API".

Tu valides **un restaurant + une période à la fois**, tu vois le résultat, puis tu décides si on passe au suivant. Pas de batch automatique → pas de surconsommation de crédits Uber, pas de surprises.

## Workflow utilisateur

```text
1. Tu ouvres la page
2. Tu vois la liste des restaurants triés par "% de mois en CSV"
   (ceux qui ont le plus à rattraper en premier)
3. Tu cliques sur un restaurant → panneau s'ouvre à droite
4. Tu vois mois par mois : badge API / CSV / Vide
5. Tu coches les mois à rattraper (ou bouton "Tout 2024", "Tout 2025"…)
6. Tu cliques "Lancer le backfill pour ce restaurant"
7. Tu vois la progression en temps réel (1 job par mois, ~1 min/job)
8. Quand c'est fini → badge récap "X mois passés en API"
9. Tu valides "OK suivant" → restaurant suivant, ou tu fermes
```

## Détail des sections de la page

**Section 1 — Liste restaurants (gauche, ~40%)**
- Colonnes : Nom · Mois en CSV · Mois en API · Mois vides · % CSV · Statut backfill
- Tri par défaut : `% CSV` décroissant (les plus prioritaires en haut)
- Filtre : marque (chain), recherche par nom
- Badge si un backfill est déjà en cours pour ce restaurant

**Section 2 — Détail restaurant (droite, ~60%)**
- Nom + uber_store_id
- Grille des mois (24 mois glissants par défaut, extensible jusqu'à 2024-01)
- Pour chaque mois : badge `API` (vert) / `CSV` (orange) / `Vide` (gris)
- Cases à cocher (les mois déjà API sont décochés et grisés par défaut)
- Boutons rapides : "Cocher tous les CSV", "Tout 2025", "Tout 2024"
- Bouton principal : `Lancer (N mois)` avec confirmation
- En bas : timeline des jobs en cours (mois X → workflow_id → status)

## Sécurité / garde-fous

- Confirmation avant lancement : "Tu vas lancer N appels Uber pour {restaurant} sur {période}. Continuer ?"
- 1 seul restaurant en cours à la fois (lock côté UI)
- Affichage du nombre estimé de jobs et du temps (~1 min/job)
- Bouton "Stop" si tu veux interrompre (marque les jobs pending en `cancelled`)

## Détails techniques (pour info)

- **Réutilise l'infra existante** `backfill_jobs` + `uber-backfill-worker` (cron toutes les minutes, déjà en place)
- Nouveau **vague 6** = `ORDER_HISTORY_REPORT` (les 5 vagues actuelles ne touchent pas `orders`)
- Nouvelle RPC `enqueue_order_history_backfill(restaurant_id, months[])` qui crée les rows dans `backfill_jobs` avec `report_type = 'ORDER_HISTORY_REPORT'` et `vague = 6`
- Nouvelle RPC `get_restaurant_data_source_calendar(restaurant_id, start, end)` qui retourne mois par mois la répartition `uber_api` / `null` / vide depuis `orders`
- Le webhook `uber-report-webhook` existant ingère déjà ORDER_HISTORY_REPORT et marque le job `done` → rien à modifier côté ingestion
- Page accessible uniquement aux super_admin (comme les autres pages backfill)

## Ce qui ne change PAS

- Aucune modification de la table `orders`, des RLS, des autres pages
- Les 5 vagues actuelles (PAYMENT, FEEDBACK, ITEM, ERRORS, DOWNTIME) continuent indépendamment
- Les badges Overview (CSV/API) se mettront à jour automatiquement dès que les commandes seront rapatriées

## Livrable

- 1 nouvelle route `/uber-backfill-ca` + entrée sidebar (super admin)
- 1 composant page + 2 composants enfants (liste, détail)
- 2 RPC SQL (calendar + enqueue)
- Réutilisation à 100% du worker et du webhook existants

Dis-moi si je lance, ou si tu veux ajuster (ex: mensuel vs hebdo, plus de mois affichés, multi-sélection de restos, etc.).
