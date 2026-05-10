## Objectif
Réduire les `429 TooManyRequests` Uber pour que les **19 144 jobs pending** se traitent sans retomber en `failed`.

## Diagnostic confirmé
- 100% des erreurs récentes = `rtapi.too_many_requests` (rate limit Uber)
- Worker actuel : `PARALLEL=5`, **0ms** entre jobs parallèles, 800ms uniquement entre sous-plages d'un même job
- Backoff 429 existant (2→32s, 5 retries) mais déclenché trop tard car on saturé d'entrée
- Cron : 1× / minute → 5 jobs lancés en burst simultané → 5 POST Uber en <1s → 429

## Changements (1 seul fichier)
`supabase/functions/uber-backfill-worker/index.ts` :

1. **`PARALLEL : 5 → 2`** — moins de POST simultanés sur la même fenêtre.
2. **Sérialiser les jobs au lieu de `Promise.allSettled`** : boucle `for` avec délai de **1500ms** entre chaque job dans le même tick. Combiné au cron 1/min, on passe de ~5 POST en burst à 2 POST espacés.
3. **Backoff initial plus large** : `delayMs = 5000` (au lieu de 2000) → 5s, 10s, 20s, 40s, 80s. Laisse plus de temps au seau Uber de se vider.

Aucun autre fichier touché. Aucune migration DB. Aucune modification fonctionnelle de la logique d'ingestion.

## Effets attendus
- Débit cible : ~2 jobs / minute = ~120 jobs/h = **~6–7 jours** pour absorber les 19k pending (vs. plantage à répétition aujourd'hui).
- Si trop lent ensuite, on pourra remonter `PARALLEL` à 3 quand on verra que les 429 ont disparu.

## Validation après déploiement
1. Attendre 5 min → vérifier les logs `uber-backfill-worker` : moins de "429 retry" attendus.
2. Query : `SELECT status, COUNT(*) FROM backfill_jobs GROUP BY status` → la colonne `done` doit augmenter régulièrement.
3. Pas besoin de re-cliquer sur "Relancer" : les pending actuels seront pickés naturellement par le cron.

## Hors scope (à faire seulement si Phase 1 insuffisante)
- Patch des edge functions pour stocker `data_source='uber_api'` (Phase 1 du plan provenance déjà approuvée).
- Backfill rétroactif `data_source` qui avait timeout.
