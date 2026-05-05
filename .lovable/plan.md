## Problème

L'ancienne contrainte unique `backfill_jobs_restaurant_id_month_start_key` sur `(restaurant_id, month_start)` est toujours active en base. Elle empêche d'avoir plusieurs `report_type` pour le même couple resto × mois, donc les vagues V2-V5 ne peuvent pas être créées.

## Correctif

Migration SQL pour supprimer l'ancienne contrainte (la nouvelle `backfill_jobs_unique_resto_month_type` sur `(restaurant_id, month_start, report_type)` reste en place et continue de protéger contre les vrais doublons) :

```sql
ALTER TABLE public.backfill_jobs
  DROP CONSTRAINT IF EXISTS backfill_jobs_restaurant_id_month_start_key;
```

## Étapes
1. Migration : drop de l'ancienne contrainte.
2. Tu cliques à nouveau sur **"Générer les jobs"** → les ~18 800 jobs des vagues V2-V5 seront créés sans conflit.
3. Le cron continue d'avancer V1 en parallèle (déjà 1 job done).

Aucun risque de doublon : la nouvelle contrainte composite garantit l'unicité par `(restaurant, mois, type de rapport)`.