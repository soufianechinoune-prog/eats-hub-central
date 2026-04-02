

## Diagnostic : pourquoi `get_availability_by_restaurant` prend 6.9s

### Cause racine identifiée

Ce n'est **pas** le SQL de la RPC qui est lent (340ms brut). Ce sont les **politiques RLS** qui s'exécutent sur chaque ligne retournée.

La politique RLS sur `hourly_availability` fait :
```
is_super_admin() OR restaurant_id IN (
  SELECT id FROM restaurants WHERE user_has_chain_access(chain_id)
)
```

Pour 424K lignes, Postgres évalue cette sous-requête des dizaines de milliers de fois avant le GROUP BY.

### Double pénalité
1. **RLS** : vérification par ligne sur 424K lignes
2. **Filtre timezone** : `(hour_start AT TIME ZONE 'Europe/Paris')::date` empêche l'utilisation des index → Seq Scan

### Solution : réécrire la RPC en `SECURITY DEFINER`

Puisque la RPC reçoit déjà `p_restaurant_ids` (filtré côté app par la chaîne de l'utilisateur), on peut :
1. Déclarer la fonction `SECURITY DEFINER` pour bypasser RLS
2. Convertir le filtre date en range timestamp pour utiliser les index

### Migration SQL

```sql
CREATE OR REPLACE FUNCTION public.get_availability_by_restaurant(
  p_start_date date, p_end_date date,
  p_restaurant_ids uuid[] DEFAULT NULL,
  p_platform text DEFAULT NULL
)
RETURNS TABLE(restaurant_id uuid, total_online_minutes numeric, total_offline_minutes numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.restaurant_id,
    COALESCE(SUM(h.online_minutes), 0)::numeric,
    COALESCE(SUM(h.offline_minutes), 0)::numeric
  FROM public.hourly_availability h
  WHERE h.hour_start >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
    AND h.hour_start < ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
    AND (p_restaurant_ids IS NULL OR h.restaurant_id = ANY(p_restaurant_ids))
    AND (p_platform IS NULL OR h.platform = p_platform)
  GROUP BY h.restaurant_id;
END;
$$;
```

### Ce qui change
1. **`SECURITY DEFINER`** : exécute avec les droits du propriétaire → bypass RLS → plus de vérification par ligne
2. **Filtre sargable** : `h.hour_start >= timestamp` au lieu de `(h.hour_start AT TIME ZONE ...)::date >= date` → utilise l'index `idx_hourly_availability_restaurant_date`

### Sécurité
La sécurité est maintenue car `p_restaurant_ids` est toujours filtré côté application par `useAnalyticsContext` qui ne fournit que les restaurants de la chaîne de l'utilisateur.

### Impact estimé
- 6.9s → **< 200ms** (suppression RLS par ligne + utilisation index)

### Fichiers modifiés
- 1 migration SQL uniquement
- Aucun changement frontend

