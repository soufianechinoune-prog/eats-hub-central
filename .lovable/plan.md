## Constat révisé

L'analyse de l'ingénieure est correcte. Après relecture de `uber-daily-backfill-trigger/index.ts` :

- `month_start = today - (windowDays+1)` → **glisse chaque jour**.
- La contrainte unique `(restaurant_id, month_start, report_type)` est donc **non-collidante entre jours différents**.
- Conséquence : un `upsert ON CONFLICT DO NOTHING` ne supprimerait quasi aucun doublon (seulement les double-exécutions du **même jour** : cron + wake worker ligne 82, ou re-trigger manuel).
- Le backlog (~590 pending) vient d'un **intake > drain**, pas de doublons.

Mon plan précédent inversait la hiérarchie : l'Étape 2 ne draine rien. Il faut **mesurer avant d'agir**.

## Plan révisé — Étape 1 seule (lecture seule, zéro risque)

Créer une RPC `admin_list_cron_jobs()` en `SECURITY DEFINER`, réservée `is_super_admin()`, qui expose les colonnes utiles de `cron.job` + un résumé sur les 7 derniers jours de `cron.job_run_details` (réussites / échecs).

### SQL

```sql
CREATE OR REPLACE FUNCTION public.admin_list_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  command text,
  active boolean,
  last_runs_7d bigint,
  failed_runs_7d bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    j.jobid,
    j.jobname,
    j.schedule,
    j.command,
    j.active,
    COALESCE(r.runs, 0)   AS last_runs_7d,
    COALESCE(r.failed, 0) AS failed_runs_7d
  FROM cron.job j
  LEFT JOIN (
    SELECT jobid,
           COUNT(*)                                                          AS runs,
           COUNT(*) FILTER (WHERE status <> 'succeeded')                     AS failed
    FROM cron.job_run_details
    WHERE start_time > now() - interval '7 days'
    GROUP BY jobid
  ) r USING (jobid);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_cron_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_cron_jobs() TO authenticated;
```

### Ce qu'on en fait

Une fois la RPC en place, je l'appelle pour obtenir le verdict factuel sur :

1. **Crons réels** : y a-t-il vraiment `worker-cron` + `worker-tick` en doublon ?
2. **Intake quotidien** : `uber-daily-backfill-trigger` est-il scheduled 1× ou N× (un par `report_type`) ?
3. **Taux d'échec cron** sur 7 jours (proxy du 429 saturation).

### Décision Étapes 2-5 — après mesure seulement

Sur la base des chiffres, on tranchera :

- **Si 429-bound** (taux d'échec élevé) → on garde la voilure mais on réduit `PARALLEL` ou on espace les workers (l'unschedule du doublon peut alors aider).
- **Si throughput-bound** (peu de 429, juste lent) → on **ajoute** du parallélisme et on garde les deux workers.
- **Si intake exagéré** (N report_types/jour × 147 restos = ~880/jour) → on réduit `window_days` ou le nombre de types journaliers.
- L'`upsert ON CONFLICT DO NOTHING` reste pertinent comme **idempotence** (race wake-worker + cron, re-trigger manuel), mais déclassé de "levier principal" à "ceinture de sécurité".
- Le requeue ciblé `failed` (hors `skipped`/188j) reste valable indépendamment.

## Hors périmètre

- Aucun changement de schéma `backfill_jobs`.
- Aucun changement à `pick_next_backfill_job` (déjà `FOR UPDATE SKIP LOCKED`).
- Aucun `cron.unschedule` ni changement de worker tant qu'on n'a pas mesuré.