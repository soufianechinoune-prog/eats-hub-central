# Accélérer le rattrapage caisse Splash360

## Objectif
Accélérer l'import de l'historique tickets Splash (actuellement ~2 jobs × 5 pages/tick toutes les 5 min) sans déclencher de limitation côté Splash. Montée en débit prudente et réversible.

## État actuel (vérifié)
- Worker `splash-ticket-backfill-worker` : batch 2 (plafond 4), budget 40 s par tick, pause de 60 s entre deux reprises d'un même job, back-off progressif sur erreur.
- Automate : un passage toutes les 5 minutes.
- 0 erreur, 0 limitation observée sur la vague en cours (Colombes + 5 restaurants).

## Changements proposés (palier 1)

1. **Plus de jobs par passage** : 2 → 4 (le plafond actuel du worker).
2. **Budget de temps par passage** : 40 s → 55 s (reste sous la limite d'exécution de la fonction).
3. **Pause entre reprises d'un même job** : 60 s → 20 s (le job devient ré-éligible presque au passage suivant).
4. **Pages par job et par passage** : inchangé — on garde la pagination actuelle pour rester doux par appel, c'est la fréquence qui augmente.

Effet attendu : débit multiplié par ~3 à ~4 (≈ 4 jobs actifs en continu au lieu de 2).

## Surveillance et garde-fous
- Le comportement en cas de limitation (429) reste inchangé : arrêt du passage en cours, pause plus longue, reprise automatique.
- **Suivi renforcé** : contrôle des compteurs d'erreurs (429/5xx) après chaque changement de palier ; si des limitations apparaissent, retour immédiat au palier précédent.
- Si le palier 1 tourne proprement pendant quelques heures : palier 2 optionnel (pause 10 s, éventuellement plus de pages par appel).

## Détails techniques
- Modifier le corps de l'appel planifié (cron) : `{"batch": 4, "budget_ms": 55000}`.
- Modifier `splash-ticket-backfill-worker` : pause entre reprises 60 s → 20 s (`next_attempt_at`), valeur par défaut du budget alignée à 55 s.
- Requête de contrôle : comptage des jobs par statut + occurrences de « THROTTLE »/erreurs dans `last_error` sur les dernières 24 h, avant/après chaque palier.
- Aucune donnée, aucun calcul, aucune interface modifiés. Aucun impact sur les restaurants déjà terminés.

## Validation
- Les jobs en cours continuent sans ré-enfilage.
- Compteurs tickets/lignes/règlements par restaurant comparés à `splash360_daily_sales` sur un restaurant témoin après le changement.
- Délai constaté avant apparition éventuelle d'une limitation documenté pour caler le palier suivant.
