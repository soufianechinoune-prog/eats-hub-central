# Bug : CA journaliers du graphique ≠ vraies données API

## Diagnostic

Vérification faite sur **Chicken Street Reims**, Mars 2026 :

| Jour | Tooltip graphique (RPC) | CA réel (heure Paris) | Écart |
|------|------------------------|-----------------------|-------|
| 1 Mar | 2 156,26 € (89 cmd) | 2 049,91 € (85 cmd) | **+106 €** |
| 2 Mar | 1 499,93 € (64 cmd) | 1 538,57 € (67 cmd) | **−39 €** |
| 3 Mar | 1 916,19 € (83 cmd) | 2 003,39 € (83 cmd) | **−87 €** |
| 4 Mar | 2 722,31 € (108 cmd) | 2 583,52 € (105 cmd) | **+139 €** |

Le tooltip affiche bien ce que la RPC `get_daily_revenue_from_orders` renvoie. **C'est la RPC qui est fausse.**

## Cause racine

La RPC traite `order_datetime` comme du **UTC brut** (sans conversion Paris) :

```sql
DATE(o.order_datetime) as date          -- ❌ groupe en UTC
o.order_datetime >= p_start_date::timestamp  -- ❌ borne en UTC
```

Conséquences :
- Une commande à `00h30 Paris` est rattachée à la **veille** (22h30 UTC en heure d'été)
- Le total mensuel tombe juste, mais la **répartition jour par jour est décalée**
- Cela viole la règle Core memory : "Use `AT TIME ZONE Europe/Paris` in SQL"
- C'est aussi la raison pour laquelle Overview (qui utilise déjà Paris) ≠ Revenue & Ventes

## Correction

Recréer `get_daily_revenue_from_orders` en utilisant `Europe/Paris` :

```sql
SELECT 
  o.restaurant_id,
  ((o.order_datetime AT TIME ZONE 'Europe/Paris'))::date AS date,
  'uber_eats'::TEXT as platform,
  COALESCE(SUM(o.sales_incl_vat), 0) as revenue_ttc,
  COUNT(*) as order_count,
  CASE WHEN COUNT(*) > 0 
    THEN ROUND(SUM(o.sales_incl_vat) / COUNT(*), 2)
    ELSE 0 
  END as average_basket
FROM public.orders o
WHERE o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
  AND o.order_datetime <  ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
  AND (p_restaurant_ids IS NULL OR o.restaurant_id = ANY(p_restaurant_ids))
GROUP BY o.restaurant_id, ((o.order_datetime AT TIME ZONE 'Europe/Paris'))::date
```

Après cette migration, le tooltip du graphique affichera **exactement** les mêmes valeurs que :
- l'Overview
- les requêtes brutes `SUM(sales_incl_vat) GROUP BY (order_datetime AT TIME ZONE 'Europe/Paris')::date`

## Impact

- Une seule fonction modifiée (`get_daily_revenue_from_orders`)
- Aucun changement de code front
- Tous les graphiques journaliers d'Analytics → Revenue & Ventes deviennent cohérents avec Overview
- Le total mensuel restera ≈ identique (juste mieux ventilé par jour)
