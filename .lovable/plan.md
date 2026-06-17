# Audit backfill Uber + diagnostic data juin

## Résultats audit (juste maintenant)

**Système stabilisé** ✅
- Dernière heure : **118 done / 0 failed** (vs 34% failed avant patch)
- Cron dupliqué supprimé : flux 429 sous contrôle
- Requeue 429 fonctionnel : 69 jobs ont déjà été requeués via `next_attempt_at`
- Débit stable ~120 jobs/h

**État global backfill_jobs**
| status  | count |
|---------|-------|
| done    | 9 444 |
| pending | 1 054 |
| failed  |   918 |
| running |     4 |

**Couverture juin (orders en base)** ✅ les données SONT là
- 1-13 juin : 7 500 à 11 100 orders/jour (normal)
- 14 juin : 1 346 (jour en cours, normal)

**Couverture juin (jobs par type de rapport)** ⚠️ partielle
- `PAYMENT_DETAILS_REPORT` : 1 793 done, 344 pending, 90 failed
- `ORDER_HISTORY_REPORT` : 30 done, 142 pending (juin 12-13 surtout)
- `DOWNTIME / FEEDBACK / MENU / ERRORS` : ~30 done / ~142 pending chacun (jobs récemment créés)

**Failed à requeuer**
- **510 jobs** failed avec `TooManyRequests` → c'est l'ancien stock pré-patch, peut être requeué maintenant que le système est stable
- 403 jobs `user_not_allowed` → restaurants déconnectés Uber (problème séparé, à traiter manuellement)
- 4 jobs erreurs réseau diverses

## Diagnostic "pas de data sur juin"

Les **orders Uber sont bien présentes** en base pour juin (60k+ lignes du 1 au 13). Donc si l'overview n'affiche rien :
- Soit les rapports `PAYMENT_DETAILS` de juin 12-13 ne sont pas encore traités (jobs pending)
- Soit un filtre UI (marque active, scope) masque les données
- Soit l'overview agrège par mois complet et juin (en cours) n'apparaît pas

## Plan d'action

### Étape 1 — Requeue des 510 jobs 429
Remettre en `pending` avec `next_attempt_at = now() + 30s` et reset `rate_limit_retries = 0`. Le worker absorbe à 120/h, donc ~4h pour drainer.

### Étape 2 — Observation 1h
- Vérifier que le requeue n'écroule pas le taux de succès (cible : <5% failed/h)
- Mesurer le drainage du pending (1564 → cible <1000 en 4h)

### Étape 3 — Diagnostic UI overview
Une fois le pending drainé, reproduire le "pas de data juin" côté UI :
- Vérifier la marque active (Chicken Street vs Tasty Crousty)
- Vérifier le sélecteur de période (mois en cours inclus ?)
- Inspecter les RPC `get_network_*` pour juin sur l'overview

### Étape 4 (séparée, optionnelle) — Restaurants déconnectés
Les 403 jobs `user_not_allowed` indiquent des restaurants avec connexion Uber expirée/révoquée. Audit séparé via `/settings/integrations`.

## Ce qui n'est PAS dans ce plan
- Toucher au worker (il fonctionne bien)
- Toucher au cron (jobid=5 seul, OK)
- Modifier le backoff (déjà calibré sur Retry-After)
- Requeue des 403 `user_not_allowed` (problème métier, pas technique)
