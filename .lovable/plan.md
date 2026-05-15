# Aligner le Comparatif des restaurants sur l'heure de Paris

## Diagnostic

Le tableau "Comparatif des restaurants" (`src/components/overview/RestaurantComparisonTable.tsx`) est alimenté par `useNetworkStats`, qui appelle 4 RPC. **Deux d'entre elles** filtrent les dates en UTC alors que le standard projet est `AT TIME ZONE 'Europe/Paris'` (cf. `mem://analytics/standard-gestion-horaire`). C'est ce qui cause l'écart Reims février : 2 202 (UTC) vs 2 200 (Paris) sur l'onglet Uber One.

| RPC | TZ actuel | À corriger |
|---|---|---|
| `get_network_orders_summary` | UTC naïf (`p_start_date::timestamp`) | Oui |
| `get_network_deliveroo_summary` | UTC naïf | Oui |
| `get_network_prep_time_summary` | timestamptz (déjà OK côté SQL, mais reçoit du UTC du front) | À vérifier côté appelant |
| `get_availability_by_restaurant` | déjà `AT TIME ZONE 'Europe/Paris'` | Non |

## Correctif (1 migration)

Modifier les deux RPC fautives pour rattacher chaque commande à sa journée locale Paris :

```sql
-- get_network_orders_summary
WHERE o.restaurant_id = ANY(p_restaurant_ids)
  AND o.order_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
  AND o.order_datetime <  ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')

-- get_network_deliveroo_summary (idem sur les deux CTE revenue_data + payout_data)
AND d.delivery_datetime >= (p_start_date::timestamp AT TIME ZONE 'Europe/Paris')
AND d.delivery_datetime <  ((p_end_date + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
```

Pas de changement de signature, pas de changement frontend.

## Effet attendu

- **Reims février** : passe de 2 202 → **2 200 commandes** (les 2 commandes du 1er fév 00h-01h UTC = 28 fév 23h-00h Paris repartent dans janvier où elles appartiennent réellement).
- **Cohérence retrouvée** entre Comparatif des restaurants ↔ Onglet Uber One ↔ Finances ↔ Overview.
- **Aucune commande perdue** : juste un re-rattachement au bon mois local.
- Effet identique sur tous les restaurants ayant des commandes en bordure de mois (typiquement les restaurants ouverts tard le soir ou en service de nuit).

## Vérification post-déploiement

1. Reims février 2026 : Comparatif affiche 2 200 commandes ; Uber One 2 200 (1438 + 762).
2. Reims janvier 2026 : Comparatif augmente de 2 commandes vs avant.
3. Spot-check 2-3 autres restaurants à fort volume nocturne pour confirmer la stabilité.

## Mémoire à mettre à jour

Ajouter une note `mem://analytics/network-stats-tz-paris` confirmant que **toutes** les RPC réseau (`get_network_*`) doivent filtrer en `AT TIME ZONE 'Europe/Paris'` — éviter qu'une future RPC réintroduise du UTC naïf.
