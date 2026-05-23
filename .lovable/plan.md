## Objectif

Créer un onglet dédié **Remboursements** dans Analytics (au même niveau que Éco-Contribution), pour analyser en profondeur les remboursements Uber Eats : montants envoyés aux clients, reprises Uber qui annulent, net réellement à la charge du restaurant — avec filtres période / plateforme / restaurant, vue € et %, graphiques et tableau restaurant par restaurant.

## Navigation

`src/components/layout/AppSidebar.tsx` — ajouter une entrée juste après "Finances & Frais" :

```
{ title: "Remboursements", url: "/analytics/refunds", icon: RotateCcw }
```

`src/pages/Analytics.tsx` — étendre le type `viewMode` avec `"refunds"`, ajouter le titre ("Remboursements" / "Analyse détaillée des remboursements clients") et brancher le rendu vers le nouveau composant `RefundsSection`.

## Données (déjà disponibles, aucune migration)

La RPC existante `get_orders_finance_detail` (utilisée par `ProfitabilityComparisonTable`) renvoie déjà :
- `refund_to_customer` — argent envoyé aux clients
- `refund_uber_cancellation` — reprises Uber qui annulent un remboursement
- `refund_net` — net à ma charge (clients − annulations)
- `sales`, `orders_count`, `restaurant_id`, `day`

→ Aucun changement backend nécessaire. On consomme la même RPC déjà agrégée côté serveur.

## Nouveau composant `src/components/analytics/RefundsSection.tsx`

### Barre de filtres (sticky en haut)
- Période (réutilise le `AnalyticsHeader` global déjà partagé entre les onglets)
- Plateforme : Uber Eats / Deliveroo / Global (Deliveroo affiche un message "données non disponibles" — voir mémoire `Deliveroo Item Limit`)
- Restaurants : multi-sélect (réutilise `useActiveRestaurants` + filtre déjà en place)
- Bascule **% / €** (comme Finances)
- Bascule granularité : Jour / Semaine / Mois

### Bloc 1 — KPIs (4 cartes)
1. **Remb. clients** — total envoyé aux clients (€) + % du CA TTC
2. **Reprises Uber** — total des annulations (€) + % des remb. clients (= "taux de récupération")
3. **Net à ma charge** — refund_net (€) + % du CA TTC ← KPI principal en avant
4. **Commandes remboursées** — nombre de commandes touchées + taux (vs total commandes)

Chaque carte avec évolution vs période N-1 (delta + flèche).

### Bloc 2 — Évolution dans le temps
Graphique combiné (barres empilées + ligne) :
- Barres : Remb. clients (rouge atténué) + Reprises Uber (vert atténué, négatif)
- Ligne : Net à ma charge (couleur primaire)
- Toggle % / € identique à Finances
- Click sur une barre → drilldown jour via `DailyFinancesSheet` existante

### Bloc 3 — Classement restaurants
Tableau triable, une ligne par restaurant :

| Restaurant | Remb. clients | Reprises Uber | Net à charge | % CA | Nb commandes remb. | Taux |
|---|---|---|---|---|---|---|

- Tri par défaut : Net à charge décroissant
- Code couleur (heatmap) sur la colonne "% CA" : vert <1%, orange 1-3%, rouge >3%
- Click sur une ligne → expand avec mini-graph d'évolution par mois pour ce restaurant

### Bloc 4 — Analyse temporelle (optionnel, en accordéon replié)
Heatmap jour de la semaine × heure (basée sur la RPC `get_orders_finance_detail` filtrée), pour identifier quand les remboursements arrivent le plus.

## Détails techniques

- Réutilise le pattern de `EcoContributionSection.tsx` (sentinel UUID, `useActiveRestaurants`, gating par `isRestaurantScopeReady`)
- Réutilise `formatCurrency` / `formatPercent` du module utils
- Aucune nouvelle RPC : la donnée est déjà calculée par `get_orders_finance_detail`. On ajoute un `useQuery` dédié dans `RefundsSection` (clé séparée) plutôt que de re-mapper depuis `FinancesSection`, pour garder l'onglet autonome et lazy-loadé.
- Respect mémoires : `chain_id` via `useActiveRestaurants`, sentinel UUID, jamais d'array vide passé à la RPC, dates locales (pas UTC.toISOString)

## Hors scope

- Deliveroo : pas de détail item-level → afficher "Données non disponibles pour Deliveroo" si plateforme = Deliveroo
- Pas de nouvelle migration SQL
- Pas de modification de `FinancesSection` (la colonne Remb. y reste avec son tooltip actuel)

## Question ouverte

Faut-il aussi inclure dans cet onglet **l'éco-contribution remboursée** (déjà traitée dans son propre onglet) ou la garder séparée ? → par défaut : **séparée**, comme aujourd'hui, sauf indication contraire.
