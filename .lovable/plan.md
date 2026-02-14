
# Optimisation des performances de la page Operations

## Probleme

La page Operations met presque 1 minute a charger pour une annee complete car elle telecharge les donnees brutes ligne par ligne :
- **hourly_availability** : 260 960 lignes en 261 requetes paginees de 1000
- **order_history (Uber One)** : 42 000+ lignes en 43 requetes paginees

## Solution

Creer des fonctions RPC (cote serveur) qui agregent les donnees avant de les envoyer au navigateur. Au lieu de 260 000 lignes, on recevra ~12 lignes (vue annuelle) ou ~31 lignes (vue mensuelle).

## Etape 1 : Creer 3 fonctions RPC pour hourly_availability

### 1a. `get_availability_monthly` (vue annuelle)
- Parametres : `p_year`, `p_restaurant_ids`, `p_platform`
- Retourne : 12 lignes max (1 par mois) avec `month`, `total_online_minutes`, `total_offline_minutes`
- Remplace les 261 requetes actuelles en vue annuelle

### 1b. `get_availability_daily` (vue mois / plage de dates)
- Parametres : `p_start_date`, `p_end_date`, `p_restaurant_ids`, `p_platform`
- Retourne : ~31 lignes max avec `date`, `total_online_minutes`, `total_offline_minutes`
- Utilise pour le drill-down mensuel

### 1c. `get_availability_by_restaurant` (classement)
- Parametres : `p_start_date`, `p_end_date`, `p_restaurant_ids`, `p_platform`
- Retourne : 1 ligne par restaurant avec totaux agreges

### 1d. `get_availability_heatmap` (heatmap jour x heure)
- Parametres : `p_start_date`, `p_end_date`, `p_restaurant_ids`, `p_platform`
- Retourne : lignes agregees par jour_de_semaine x heure (max 168 lignes)

## Etape 2 : Creer 1 fonction RPC pour Uber One

### `get_uber_one_stats`
- Parametres : `p_start_date`, `p_end_date`, `p_restaurant_ids`, `p_platform`, `p_granularity` ('monthly' ou 'daily')
- Retourne par periode et par restaurant : `uber_one_count`, `non_uber_one_count`, `uber_one_revenue`, `non_uber_one_revenue`, `uber_one_prep_time_sum`, `non_uber_one_prep_time_sum`
- Remplace les 43 requetes paginees actuelles par 1 seule requete

## Etape 3 : Adapter le frontend

### OperationsAnalytics.tsx
- Remplacer la boucle de pagination `hourly_availability` par des appels aux nouvelles RPC
- Vue annuelle : appel a `get_availability_monthly`
- Vue mois/plage : appel a `get_availability_daily`  
- Classement : appel a `get_availability_by_restaurant`
- Heatmap : appel a `get_availability_heatmap`
- Vue jour (drill-down horaire) : conserver la requete directe filtree sur 1 jour (max ~24 lignes)

### useUberOneStats.ts
- Remplacer la boucle de pagination par un appel a `get_uber_one_stats`
- Adapter le traitement des donnees pour utiliser les resultats agreges

## Gains attendus

```text
Avant :  261 requetes x 1000 lignes = 260 960 lignes  (~1 min)
Apres :  4-5 requetes x ~30 lignes  = ~150 lignes     (~1-2 sec)
```

## Detail technique des fonctions SQL

Chaque fonction sera creee via une migration SQL. Exemple de structure :

```text
get_availability_monthly(p_year, p_restaurant_ids, p_platform)
  -> SELECT
       EXTRACT(MONTH FROM hour_start) as month,
       SUM(online_minutes),
       SUM(offline_minutes)
     FROM hourly_availability
     WHERE year = p_year
       AND (p_restaurant_ids IS NULL OR restaurant_id = ANY(p_restaurant_ids))
       AND (p_platform IS NULL OR platform = p_platform)
     GROUP BY month
     ORDER BY month
```

Les requetes existantes dans le frontend seront remplacees par des appels `supabase.rpc(...)` simples, comme ce qui est deja fait ailleurs dans le projet (ex: `get_hourly_order_performance`).
