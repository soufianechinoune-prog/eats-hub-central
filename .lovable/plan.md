

# Bug : sélection du 22 affiche aussi le 23

## Diagnostic

Le problème vient d'un décalage timezone dans les fonctions SQL d'availability.

**WHERE clause** : filtre sur `hour_start` en UTC brut
```sql
WHERE h.hour_start >= '2026-02-22'::timestamp   -- UTC
  AND h.hour_start < '2026-02-23'::timestamp     -- UTC
```

**GROUP BY** : agrège par jour en timezone Paris
```sql
GROUP BY (h.hour_start AT TIME ZONE 'Europe/Paris')::date
```

Conséquence : un enregistrement à `2026-02-22T23:00:00 UTC` est inclus par le WHERE (c'est bien le 22 en UTC), mais converti en `2026-02-23T00:00:00 Paris` dans le GROUP BY. Il apparait donc comme une barre "23" dans le graphique.

Ce même problème affecte les 4 fonctions RPC d'availability : `get_availability_daily`, `get_availability_by_restaurant`, `get_availability_heatmap`, et `get_availability_monthly`.

## Correction

Aligner le WHERE sur la timezone Paris pour que le filtrage et le regroupement soient cohérents. Modifier les 4 fonctions RPC :

```sql
-- Avant (UTC brut)
WHERE h.hour_start >= p_start_date::timestamp
  AND h.hour_start < (p_end_date + interval '1 day')::timestamp

-- Après (timezone-aware)
WHERE (h.hour_start AT TIME ZONE 'Europe/Paris')::date >= p_start_date
  AND (h.hour_start AT TIME ZONE 'Europe/Paris')::date <= p_end_date
```

Cela garantit que les enregistrements sont filtrés selon le même jour calendaire Paris que celui utilisé pour le regroupement. Un enregistrement à 23h UTC le 22 (= minuit le 23 à Paris) sera correctement exclu quand on sélectionne uniquement le 22.

### Fichier modifié
- **Migration SQL** : nouvelle migration pour recréer les 4 fonctions avec le WHERE corrigé

### Impact
- Aucun changement côté frontend
- Les données filtrées et agrégées seront cohérentes quelle que soit l'heure de la journée
- Légère différence de performance SQL (utilisation de AT TIME ZONE dans le WHERE) mais négligeable sur ce volume de données

