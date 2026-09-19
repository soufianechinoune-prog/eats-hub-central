# Retour à la cadence normale de l'automate de rattrapage caisse

## État vérifié
- Les 11 jobs de `splash_ticket_backfill_jobs` sont tous `completed` (file vide).
- 0 erreur, 0 limitation (THROTTLE) enregistrée.
- L'automate tourne encore toutes les 2 minutes (réglage temporaire du rattrapage).

## Action
1. **Replanifier l'automate** : toutes les 2 min → toutes les 5 min (cadence normale), body `{"batch": 4, "budget_ms": 55000}` inchangé.
2. **Vérifier** que le prochain passage répond bien « file vide » sans travail inutile.

## Détails techniques
- `pg_cron` : `cron.schedule('splash-ticket-backfill-tick', '*/5 * * * *', ...)` (unschedule puis reschedule).
- La garde `WHERE EXISTS` (aucun passage quand la file est vide) reste en place.
- Verrous `locked_until` résiduels : ignorés — les jobs sont tous terminés, aucun verrou actif ne bloque quoi que ce soit.

## Validation
- Cadence revenue à 5 min, file vide, aucun changement de données ni de calculs.
