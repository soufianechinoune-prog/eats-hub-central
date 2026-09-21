# Accélérer le rattrapage caisse Splash (palier 2)

## Constat

- File : 4 437 travaux au total, **437 terminés**, 1 en cours, 3 999 en attente.
- **0 erreur, 0 limitation (429/5xx) côté Splash** depuis le début — l'API encaisse.
- Rythme réel mesuré : ~200 travaux / 24 h → **~3 semaines** restantes à cadence actuelle (4 travaux / passage toutes les 2 min, pause 20 s, budget 55 s).
- Le verrou anti-doublon (`locked_until`) est déjà en place : deux passages ne peuvent pas traiter le même travail.

## Changements (palier 2)

1. **Plus de travaux par passage** : batch 4 → **8** (plafond inchangé ailleurs).
2. **Passages plus fréquents** : automate toutes les 2 min → **toutes les minutes**, avec le body `{"batch":8,"budget_ms":55000}`. (720 → 1 440 passages/jour ; chaque passage ne fait du travail que si la file contient des travaux.)
3. **Pause entre reprises raccourcie** : 20 s → **5 s** dans le worker (le pacing interne entre pages Splash est conservé).
4. **Verrou conservé** : `locked_until` 3 min à la prise de chaque travail — un passage qui chevauche le précédent ne peut pas prendre deux fois le même travail.

## Surveillance et garde-fous

- Compteurs relevés avant/après : travaux terminés / 24 h, erreurs, occurrences de limitation Splash.
- **Rollback automatique au palier précédent** (batch 4, 2 min, pause 20 s) dès apparition de 429/5xx.
- Rythme mesuré communiqué après la première heure, ETA recalculée.
- La cadence redescend à 5 minutes **uniquement quand la file sera entièrement vidée**.

## Impact attendu

Rythme cible : ~800–1 200 travaux / 24 h → historique complet en **4 à 6 jours** au lieu de ~3 semaines.

## Détails techniques

- Edge function `splash-ticket-backfill-worker` : batch par défaut 8, `next_attempt_at` de reprise à +5 s, budget 55 s inchangé.
- Cron `splash-ticket-backfill-tick` : `*/2` → `* * * * *`.
- Aucune donnée, table, RPC ni écran modifiés ; l'import reste idempotent (clés naturelles + upserts).
