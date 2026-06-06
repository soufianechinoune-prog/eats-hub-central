# Sync automatique Splash360

## Objectif
Déclencher automatiquement la synchronisation des ventes Splash360 pour toutes les marques actives, selon ce rythme (heure de Paris) :
- **11h00 → 00h00** : toutes les 30 minutes (plage business)
- **00h00 → 11h00** : toutes les heures (plage creuse)

Soit ~27 runs/jour au lieu d'un déclenchement manuel.

## Ce qui sera mis en place

### 1. Activation des extensions Postgres
- `pg_cron` (planification)
- `pg_net` (appels HTTP vers l'edge function)

### 2. Deux jobs cron
Schedulés en UTC mais réfléchis pour tomber juste en heure de Paris :

| Job | Cron (UTC l'hiver / été) | Effet Paris |
|-----|--------------------------|-------------|
| `splash360-sync-day` | `*/30 10-22 * * *` | toutes les 30 min de 11h à 23h30 |
| `splash360-sync-night` | `0 23,0-9 * * *` | toutes les heures de 00h à 10h |

Les deux appellent `POST /functions/v1/sync-splash360` avec `{ "sync_all_active": true }`.

Note : `pg_cron` ne supporte pas les fuseaux. On choisit un compromis qui reste correct toute l'année (décalage d'1 h entre été et hiver, sans impact métier).

### 3. Table de logs `splash360_sync_runs`
Pour monitorer chaque run :
- date/heure de déclenchement
- durée
- nombre de connexions traitées
- nombre de lignes upsertées
- erreurs éventuelles

L'edge function `sync-splash360` (mode `sync_all_active`) sera modifiée pour insérer une ligne dans cette table à chaque exécution.

### 4. Page admin "Historique des syncs Splash360"
Petit tableau dans le portail super admin listant les 50 derniers runs (timestamp, marque, durée, lignes, erreurs). Permet de voir si tout roule sans ouvrir les logs edge.

## Kill-switch
Aucun nouveau bouton nécessaire :
- Désactiver une marque = passer `is_active = false` sur sa ligne `chain_pos_connections` (déjà géré dans la page Intégrations).
- Couper tout le cron = `SELECT cron.unschedule('splash360-sync-day')` + `cron.unschedule('splash360-sync-night')`.

## Détails techniques

- L'edge function existe déjà (`supabase/functions/sync-splash360/index.ts`) et gère parfaitement le mode `sync_all_active`. Pas de refonte, juste ajout du logging.
- Pas de risque sur les données : upsert idempotent sur `(chain_id, restaurant_splash_id, date, granularity, platform)`.
- Les jobs cron sont créés via `supabase--insert` (et non `supabase--migration`) car ils contiennent l'URL du projet et l'anon key — donnée spécifique à cet environnement.

## Risques résiduels
- **Rate limit Splash360 inconnu** : on saura à l'usage. Si erreurs HTTP 429 → on baisse la fréquence. La table de logs permet de les détecter immédiatement.
- **Empilement si une sync dépasse 30 min** : peu probable (sync mensuelle = quelques secondes par marque), mais on ajoutera un garde-fou simple si besoin plus tard.

## Hors scope (volontairement)
- Pas de webhook Splash → en attente de réponse de Lakhdar.
- Pas de retry automatique sur erreur → un run loupé est rattrapé 30 min plus tard.
- Pas d'alerte email/Slack sur erreur → si besoin, on l'ajoutera après quelques jours d'observation.
