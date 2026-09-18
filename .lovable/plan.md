# Accélérer le rattrapage caisse Splash360

## Objectif
Accélérer l'import de l'historique tickets Splash sans déclencher de limitation côté Splash. Montée en débit graduelle, réversible, avec verrou anti-doublon et surveillance des erreurs.

## État actuel (vérifié)
- Worker `splash-ticket-backfill-worker` : batch 2 (plafond 4), budget 40 s par passage, pause de 60 s entre deux reprises d'un même job, back-off progressif sur erreur.
- Automate : un passage toutes les 5 minutes (288 passages/jour).
- 0 erreur, 0 limitation observée sur la vague en cours (Colombes + 5 restaurants).

## Palier 1 — réglages par passage

1. **Jobs par passage** : 2 → 4 (plafond actuel du worker).
2. **Budget de temps par passage** : 40 s → 55 s (sous la limite d'exécution).
3. **Pause entre reprises d'un même job** : 60 s → 20 s.

## Levier fréquence — cron rapproché (temporaire)

4. **Fréquence de l'automate** : toutes les 5 min → **toutes les 2 min** (720 passages/jour) pendant la durée du rattrapage uniquement. Le worker fait ~55 s de travail puis reste inactif ~4 min : rapprocher les passages accélère davantage que les réglages par passage.
   - Garde existante conservée : aucun passage ne part quand la file est vide.
   - **Retour à 5 min dès la file vidée** (action explicite en fin de rattrapage).
   - Trade-off coût : 720 passages/jour au lieu de 288 maintiennent la base plus active ; c'est temporaire et borné à la durée du rattrapage.

## Verrou anti-doublon (obligatoire avec le cron rapproché)

5. À 2 min, un passage peut chevaucher le précédent (55 s de travail + appels API). Ajout d'un **verrou par job** : la prise d'un job passe par une mise à jour conditionnelle atomique (`UPDATE ... WHERE status IN ('pending','running') AND (locked_until IS NULL OR locked_until < now()) RETURNING`) qui pose `locked_until = now() + 3 min`. Un second passage concurrent ne voit pas les jobs déjà pris ; en cas de crash, le verrou expire seul et le job reprend. Colonne `locked_until` ajoutée à `splash_ticket_backfill_jobs`.

## Surveillance et garde-fous
- Comportement sur limitation (429) inchangé : arrêt du passage, pause longue, reprise automatique.
- **Contrôle des compteurs** avant/après chaque palier : jobs par statut + occurrences « THROTTLE »/erreurs dans `last_error` sur 24 h.
- **Rollback** : si des 429/5xx apparaissent, retour immédiat aux réglages précédents (batch 2, budget 40 s, pause 60 s, cron 5 min) — les quatre paramètres sont indépendants et réversibles.
- Palier 2 optionnel seulement après quelques heures propres (pause 10 s, pages par appel).

## Détails techniques
- `pg_cron` : replanifier `splash-ticket-backfill-tick` en `*/2 * * * *`, body `{"batch": 4, "budget_ms": 55000}`.
- `splash-ticket-backfill-worker` : pause entre reprises 60 s → 20 s ; sélection des jobs via verrou `locked_until` ; libération du verrou à chaque mise à jour de statut.
- Migration : `ALTER TABLE splash_ticket_backfill_jobs ADD COLUMN locked_until timestamptz`.
- Compteurs tickets/lignes/règlements comparés à `splash360_daily_sales` sur un restaurant témoin après changement.

## Validation
- Aucun job traité deux fois (unicité des clés naturelles + verrou).
- Aucune donnée, aucun calcul, aucune interface modifiés.
- Délai avant éventuelle limitation documenté pour caler la suite.
