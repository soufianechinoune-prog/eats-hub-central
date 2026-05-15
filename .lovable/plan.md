## Le diagnostic (pour toi)

Le tab **Uber One** dans Analytics → Opérations affiche "Aucune donnée" pour Reims Février 2026, alors qu'on a bien la data.

**Pourquoi :**
- Le tab Uber One lit la table `order_history` (alimentée par les **CSV imports historiques** Uber)
- Reims n'a **jamais** eu d'import CSV → `order_history` est **vide** pour ce resto
- Mais on a 2 202 commandes dans `orders` (table **API**), dont :
  - **1 438 commandes "Membre Uber One"** (65,3 %)
  - **764 commandes "Non membre"** (34,7 %)
- L'info est dans la colonne `orders.uber_one_status` (texte : `"Membre Uber One"` ou `"Non membre"`)

Donc la donnée est là, juste pas branchée.

## Ce qu'on va faire

Modifier la RPC SQL `get_uber_one_stats` pour qu'elle lise les deux sources :

1. **`order_history`** (CSV imports) — ce qu'elle fait aujourd'hui
2. **`orders`** (API) en complément — nouveau

Avec **déduplication par `uber_order_id`** : si une commande existe dans les deux tables (cas où un resto a à la fois CSV historique + API live), on ne la compte qu'une seule fois en privilégiant `order_history` (qui a déjà tous les champs prep_time, etc.).

## Mapping des champs

| Métrique          | `order_history` (existant) | `orders` (ajout)                                |
|-------------------|---------------------------|-------------------------------------------------|
| Uber One ?        | `uber_one = true`         | `uber_one_status = 'Membre Uber One'`           |
| Date              | `order_datetime`          | `order_datetime`                                |
| Restaurant        | `restaurant_id`           | `restaurant_id`                                 |
| Plateforme        | `platform`                | `'uber_eats'` (toutes les commandes orders)     |
| CA commande       | `order_amount`            | `sales_incl_vat`                                |
| Temps prépa       | `initial_prep_time_minutes` | **non dispo** → 0 (le panel "temps prépa Uber One vs non" sera juste basé sur les restos ayant CSV) |

## Détails techniques

```text
RPC get_uber_one_stats
  ├── CTE source = UNION ALL
  │     ├── SELECT … FROM order_history WHERE filtres
  │     └── SELECT … FROM orders
  │           WHERE filtres
  │             AND uber_order_id NOT IN (SELECT uber_order_id FROM order_history WHERE filtres)
  │             AND platform_filter ∈ {NULL, 'uber_eats'}
  └── GROUP BY period_key, restaurant_id (logique inchangée)
```

- Aucune modification frontend nécessaire (le hook `useUberOneStats` consomme la même RPC, mêmes colonnes en sortie).
- La RPC reste `SECURITY DEFINER` avec `statement_timeout = 30s`.
- Aucun impact sur les restos qui ont du CSV (la déduplication les protège).

## Bonus à prévoir (à valider)

Une fois le tab Uber One alimenté, **3 autres endroits** ont potentiellement le même symptôme pour Reims (lecture exclusive de `order_history`) :
- Disponibilité / Prépa initial / Attente coursier / Temps de prépa total / Erreurs (les autres tabs Opérations)

Mais pour ces 5 tabs, **les champs n'existent pas dans `orders`** (pas de prep_time, courier_arrival, etc. dans la table API). Donc on ne peut **pas** faire le même fallback. Reims restera vide sur ces 5 tabs tant qu'il n'aura pas d'import CSV.

→ Uber One est le **seul** tab qu'on peut sauver avec la data API.

## Déploiement

1 migration SQL : remplacer la RPC `get_uber_one_stats`. Pas de changement de signature, pas de touch côté frontend.
