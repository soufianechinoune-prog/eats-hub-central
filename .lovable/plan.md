# Recentrer le backfill Splash sur Reims uniquement

## Objectif
Arrêter le backfill global en cours (2825 jobs, ~9h), repartir d'une base propre, et ne backfiller que **Chicken Street Reims** (id `418`) sur la période **2024-05-01 → aujourd'hui** (~550 jobs, ~2h).

## Étapes

### 1. Mettre le worker en pause
Désactiver le cron `splash-backfill-worker` via `cron.unschedule(...)` (ou `cron.alter_job` avec `active := false`). Cela stoppe immédiatement la consommation de nouveaux jobs.

### 2. Purger les données existantes
- `DELETE FROM splash_backfill_jobs` (tous statuts : pending, running, completed, failed) → table vide.
- `DELETE FROM splash_daily_sales` → on repart de zéro, base propre Reims-only.

### 3. Vérifier l'identité Reims
Confirmer que le restaurant Reims (`418`) a bien un mapping Splash (`splash_restaurant_id` non null dans `restaurants` ou table de mapping). Si non, il faudra le créer avant d'enqueuer.

### 4. Enqueue Reims uniquement
Insérer ~550 jobs `pending` dans `splash_backfill_jobs` :
- `restaurant_id = 418`
- 1 job par jour, du `2024-05-01` au `CURRENT_DATE`
- `granularity = 'day'`, `status = 'pending'`

### 5. Réactiver le worker
Re-schedule le cron `splash-backfill-worker` (* * * * *). Il ne verra plus que les jobs Reims → ~2h pour finir.

### 6. Suivi
Vérifier au prochain message la progression (`SELECT status, count(*) FROM splash_backfill_jobs GROUP BY status`) et inspecter les premières lignes de `splash_daily_sales` pour Reims.

## Détails techniques

**Tables touchées** (data uniquement, aucune migration de schéma) :
- `splash_backfill_jobs` : DELETE all + INSERT ~550 lignes Reims
- `splash_daily_sales` : DELETE all
- `cron.job` : unschedule + reschedule du worker

**Outils** :
- `supabase--insert` pour les DELETE/INSERT data
- `supabase--insert` pour `cron.unschedule` / `cron.schedule` (data, pas schéma)
- `supabase--read_query` pour vérifier l'id Splash de Reims avant enqueue

**Aucune modification de code ou de fichier** dans le projet — purement opérationnel côté DB.

## Après ce plan
Une fois le backfill Reims terminé (~2h), on passera à l'étape 2 : construire l'UI "Caisse" sur Reims comme restaurant pilote. Le backfill du reste du réseau se fera quand les bases UI seront validées.
