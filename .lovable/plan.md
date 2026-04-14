

# Fix: Graphiques "Rentabilité globale" et UberOne qui bloquent

## Problème
Les logs montrent des timeouts `57014` répétés. Deux causes :

1. **`get_uber_one_stats`** n'est pas `SECURITY DEFINER` → la RLS scanne 4.4M lignes avec sous-requête à chaque appel → timeout
2. **Requêtes profitability** (`get_profitability_daily`) : bien que déjà SECURITY DEFINER, elles n'ont pas `retry: false` → React Query relance 3 fois chaque timeout (3 × ~30s = 1min30 d'attente)
3. **`useUberOneStats`** dans `AnalyticsCharts.tsx` se lance même en mode revenue sur la plateforme Uber Eats alors qu'il n'est pas nécessaire pour les graphiques principaux

## Corrections

### 1. Migration SQL — `get_uber_one_stats` en SECURITY DEFINER
```sql
ALTER FUNCTION public.get_uber_one_stats(timestamptz, timestamptz, uuid[], text, text)
  SECURITY DEFINER SET search_path = public;
```

### 2. `src/pages/Analytics.tsx` — retry: false sur les requêtes profitability
Ajouter `retry: false` aux deux queries `get_profitability_daily` (current + prev period, lignes ~533 et ~554).

### 3. `src/hooks/useUberOneStats.ts` — retry: false
Ajouter `retry: false` à la query `get_uber_one_stats` (ligne ~110).

## Résultat attendu
- `get_uber_one_stats` bypass la RLS → temps de réponse de timeout → quelques secondes
- Plus de retries inutiles sur les timeouts → feedback immédiat
- Le graphique "Rentabilité globale" charge en quelques secondes au lieu de bloquer

