## Page `/live` — Pilotage temps réel multi-canal

Une page dédiée qui consolide en direct l'activité Uber Eats, Dishop et Caisse Splash360, avec rafraîchissement automatique toutes les 30-60s. KPIs agrégés uniquement (pas de feed commande par commande).

### 1. Structure de la page

```text
┌───────────────────────────────────────────────────────────────────┐
│  🟢 LIVE — Jeudi 25 juin · 14:32              [Restaurants: 103▾] │
│                                                  Auto-refresh 30s │
├───────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ TOTAL JOUR  │ │  UBER EATS  │ │   DISHOP    │ │   CAISSE    │ │
│  │  142 380 €  │ │   85 200 €  │ │   12 450 €  │ │   44 730 €  │ │
│  │ 3 218 cmds  │ │ 1 842 cmds  │ │  287 cmds   │ │ 1 089 cmds  │ │
│  │ Panier 44€  │ │ vs hier +8% │ │  vs hier -3%│ │ vs hier +5% │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│  Activité heure par heure (aujourd'hui vs hier vs moy. 4 sem.)    │
│  [ Graphique aires empilées Uber/Dishop/Caisse ]                  │
├───────────────────────────────────────────────────────────────────┤
│  Top 10 restaurants en direct                                     │
│  Rang · Restaurant · CA · Commandes · Uber% · Dishop% · Caisse%   │
└───────────────────────────────────────────────────────────────────┘
```

### 2. Sources de données par canal

| Canal | Source live | Fraîcheur réelle | Badge UI |
|-------|-------------|------------------|----------|
| **Uber Eats** | `uber_live_orders` (webhook `orders.notification`) | Temps réel (~secondes) | 🟢 Live |
| **Dishop** | `dishop_orders` via sync raccourcie (toutes les 15 min au lieu d'hebdo) | ~15 min | 🟡 Quasi-live |
| **Caisse** | `splash360_daily_sales` via sync `scope=today` toutes les 30 min | ~30 min | 🟡 Quasi-live |

Chaque KPI affichera son badge de fraîcheur + horodatage de la dernière mise à jour pour transparence.

### 3. Navigation

- Nouvelle entrée sidebar **« Live »** avec pastille verte pulsante, placée tout en haut au-dessus d'Overview.
- Route `/live`, scopée multi-tenant via `useActiveRestaurants()`.
- Sélecteur restaurants identique à Overview (réseau / pinned / individuel).

### 4. Backend — ce qui doit être ajouté

1. **Cron Dishop raccourci** : nouveau cron `dishop-live-sync` toutes les 15 min, qui n'importe que les commandes du jour (delta) au lieu du ZIP hebdo complet. Le ZIP hebdo reste pour la consolidation.
2. **Cron Splash360 raccourci** : `pg_cron` déclenchant `sync-splash360?scope=today` toutes les 30 min (déjà supporté depuis le fix d'hier).
3. **3 RPC agrégées** (rapides, indexées) :
   - `get_live_uber_today(restaurant_ids, day)` → CA, commandes, panier, hier, courbe horaire
   - `get_live_dishop_today(restaurant_ids, day)` → idem sur `dishop_orders`
   - `get_live_splash_today(restaurant_ids, day)` → idem sur `splash360_daily_sales`
4. **1 RPC top restaurants** : `get_live_top_restaurants(restaurant_ids, day, limit)` qui croise les 3 sources.

### 5. Frontend

- `src/pages/Live.tsx` — page principale
- `src/hooks/useLiveOverview.ts` — fetch parallèle des 4 RPC, refetch toutes les 30s via React Query (`refetchInterval`)
- `src/components/live/LiveKpiCard.tsx` — carte KPI avec badge fraîcheur + delta vs hier
- `src/components/live/LiveHourlyChart.tsx` — Recharts aires empilées
- `src/components/live/LiveTopRestaurants.tsx` — tableau classement
- Réutilisation de `UberLiveTodayCard` (déjà créée hier) pour cohérence

### 6. Hors scope (pour cadrer)

- Pas de feed commande par commande (choix utilisateur)
- Pas d'alertes (commande annulée, restaurant offline) — à proposer en V2
- Pas de Deliveroo (pas d'API publique disponible)
- Pas de notification push / WhatsApp en temps réel

### Récap des étapes d'implémentation

1. RPC SQL `get_live_*` (4 fonctions) — migration
2. Cron Dishop 15 min + Cron Splash360 30 min — migration `pg_cron`
3. Edge function `dishop-live-sync` (delta jour uniquement)
4. Hooks React Query + composants UI Live
5. Entrée sidebar + route `/live`
6. Vérification : ouvrir `/live`, contrôler refresh auto, comparer KPIs à Overview
