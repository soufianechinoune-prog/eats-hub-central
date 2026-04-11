

# Fix : Prépa Initial trop lent a charger

## Probleme

`PrepTimeAnalytics` telecharge **toutes les commandes individuelles** de `order_history` (10 000+ lignes pour 1 mois x 101 restaurants) page par page (1000 a la fois) pour calculer des moyennes quotidiennes/mensuelles cote client. C'est la meme architecture lente que le graphique de rentabilite qu'on vient de corriger.

## Solution

Creer une RPC SQL `get_prep_time_daily` qui fait l'agregation directement en base, et l'utiliser dans `PrepTimeAnalytics` a la place du fetch individuel.

## Modifications

### 1. Migration SQL : nouvelle RPC `get_prep_time_daily`

```sql
CREATE FUNCTION get_prep_time_daily(
  p_restaurant_ids uuid[],
  p_start_date date,
  p_end_date date,
  p_platform text DEFAULT NULL
)
RETURNS TABLE(
  restaurant_id uuid,
  day date,
  hour integer,        -- NULL pour l'agregat journalier, 0-23 pour le detail horaire
  avg_prep_time numeric,
  min_prep_time numeric,
  max_prep_time numeric,
  order_count bigint
)
```

La RPC retourne :
- Agregats par jour et restaurant (hour = NULL) pour les graphiques quotidiens/mensuels
- Agregats par jour+heure et restaurant (hour = 0-23) pour le drill-down journalier
- KPIs globaux calculables par simple SUM/AVG sur le resultat

### 2. `src/components/analytics/PrepTimeAnalytics.tsx`

- Remplacer le `useQuery` qui pagine `order_history` par un appel a `supabase.rpc('get_prep_time_daily', ...)`
- La RPC retourne ~30-400 lignes (vs 10 000+) — chargement instantane
- Adapter les `useMemo` (kpis, monthlyEvolution, dailyEvolution, hourlyEvolution) pour consommer le format RPC au lieu des commandes individuelles
- Garder le meme rendu visuel (graphiques, KPIs, classement)

### 3. Performances attendues

- Chargement passe de ~5-15 secondes a < 1 seconde
- Plus de pagination client (while loop avec 10+ requetes)
- Le filtre restaurant/platform est applique cote serveur

