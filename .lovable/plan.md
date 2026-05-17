# Pourquoi c'est long aujourd'hui

Sur `/compare/downtime` en mode **Réseau (168 restaurants) × année 2026** :

- La page récupère **toutes les lignes brutes** de `hourly_availability` (1 ligne par restaurant × jour × heure).
- Volume estimé : **168 × ~131 jours × 24h ≈ 528 000 lignes**.
- Le client pagine par **1 000 lignes/requête** en **séquentiel** → ~**530 allers-retours réseau** avant que le moindre pixel ne s'affiche.
- Tout l'agrégat (taux dispo journalier, heatmap, classement) est ensuite calculé **côté navigateur** sur ce gros tableau.

Conclusion : ce n'est pas "normal", c'est un vrai goulot d'étranglement, le même pattern qu'on a déjà optimisé ailleurs (Overview, Finances yearly).

# Plan d'optimisation

## 1. Créer une RPC d'agrégation serveur

Nouvelle fonction Postgres `get_downtime_comparison(restaurant_ids uuid[], start_date date, end_date date)` (SECURITY DEFINER, filtre `chain_id` via `has_restaurant_access`) qui renvoie **déjà agrégé** :

- Par restaurant : `total_offline_minutes`, `total_online_minutes`, `availability_rate` (moyenne des taux journaliers).
- Par restaurant × jour : `online`, `offline`, `rate`.
- Par restaurant × jour × heure : `online`, `offline`, `rate` (pour les barres horaires).
- Par restaurant × heure de la journée et × jour de semaine : minutes offline (heatmap).

Tout est fait en SQL avec `date_trunc` / `extract`, donc 1 seule requête réseau au lieu de 530.

## 2. Brancher `DowntimeComparison.tsx` sur la RPC

- Remplacer la boucle `while (hasMore) { range(...) }` dans `useQuery` par un `supabase.rpc("get_downtime_comparison", { ... })`.
- Adapter `restaurantStats` pour consommer la structure déjà agrégée (les `useMemo` deviennent triviaux).
- Garder le même comportement côté UI (tri, vues Épinglés/Réseau, filtres période, exports PDF/Excel).

## 3. Garde-fous

- Sentinelle multi-tenant : ne déclencher la RPC qu'après résolution du `chain_id` (pattern `useActiveRestaurants`).
- Index attendu : `hourly_availability (restaurant_id, platform, hour_start)` — à vérifier, ajouter si manquant.
- Conserver les requêtes `earliest-date` / `latest-date` (légères, déjà en `limit(1)`).

# Détails techniques

- Aucun changement de schéma de données, juste une fonction SQL en plus.
- Aucun changement visuel : mêmes composants `DowntimeRankingBars`, `DowntimeHeatmapGrid`, `DowntimeInsightsSection`.
- Gain attendu : passage de **~530 requêtes + ~50 Mo JSON** à **1 requête + quelques dizaines de Ko**, chargement de plusieurs dizaines de secondes → 1–2 s.

# Hors scope

- Pas de modification des imports CSV ni de l'edge function `parse-downtime-report`.
- Pas de refonte UI.
