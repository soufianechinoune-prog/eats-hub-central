## Contexte

La data Uber est figée au **17 mai 2026** pour tous les restaurants (on est le 2 juin). Plus aucun `report.success` reçu depuis 16 jours. Aucun cron Uber n'existe : la remontée dépend soit d'un backfill manuel, soit d'un report planifié côté Uber qui ne se déclenche plus.

Par ailleurs, certains Tasty Crousty n'ont pas encore tout leur historique mensuel récupéré. **Bonne nouvelle : les deux flux (cron quotidien + backfill historique) cohabitent sans risque** grâce à la file de jobs commune (`backfill_jobs`), au worker séquentiel, et à l'upsert anti-doublon (`ON CONFLICT order_id`).

## Étapes (dans l'ordre)

### Étape 1 — Combler le trou récent (18 mai → 31 mai 2026)
Déclencher immédiatement un backfill ponctuel pour les 60 restaurants actifs sur cette plage. Utilise l'infra existante (`uber-backfill-reports` → file `backfill_jobs` → `uber-backfill-worker` → webhook).

Estimation : 60 restos × 1 fenêtre (14 jours, ≤30 donc 1 seul rapport Uber par resto) = 60 jobs. Avec 2 jobs en parallèle et ~10-15 min par job (création + attente webhook Uber), ça remontera progressivement sur 4 à 8 heures.

### Étape 2 — Mettre en place le cron quotidien
Créer un cron `uber-daily-backfill` qui tourne **tous les jours à 5h UTC** (après la coupure J-1 Uber) et planifie un backfill incrémental **J-3 → J-1** pour tous les restaurants actifs ayant un `uber_store_id`.

Pourquoi J-3 → J-1 :
- Uber publie les paiements avec ~24-48h de délai
- 3 jours de chevauchement = filet de sécurité en cas d'échec ponctuel
- L'upsert sur `order_id` empêche tout doublon

```text
pg_cron (0 5 * * *)
   └─► net.http_post → edge function "uber-daily-backfill-trigger"
              └─► pour chaque restaurant actif avec uber_store_id
                     └─► insert job dans backfill_jobs (J-3 → J-1)
                            └─► uber-backfill-worker (déjà existant)
                                   └─► uber-create-report → Uber API
                                          └─► webhook report.success → ingestion
```

### Étape 3 — S'assurer que le worker tourne (cron de "tick" toutes les minutes)
Vérifier qu'un cron déclenche `uber-backfill-worker` régulièrement (toutes les minutes). S'il n'existe pas/plus, le créer. Sans ce tick, les jobs insérés en étape 1 et 2 resteraient `pending` indéfiniment.

### Étape 4 — Badge "fraîcheur data" dans l'Overview
Petit indicateur en haut de la page Overview : "Dernière commande Uber : il y a X heures"
- vert : <48h
- orange : 48h–7j
- rouge : >7j

Permet de détecter immédiatement si la remontée recasse à l'avenir.

### Étape 5 — (Plus tard, séparément) Compléter les historiques Tasty Crousty
Une fois l'étape 1-3 stables, je peux détecter automatiquement les trous mensuels par restaurant et planifier les jobs de rattrapage historique. À traiter dans une demande dédiée pour ne pas mélanger.

## Détails techniques

### Migration cron quotidien
```sql
SELECT cron.schedule(
  'uber-daily-backfill',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://akcicojkrzeirffefdet.supabase.co/functions/v1/uber-daily-backfill-trigger',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
    body := '{"window_days": 3}'::jsonb
  );
  $$
);
```

### Nouvelle edge function `uber-daily-backfill-trigger`
- Lit les restaurants actifs avec `uber_store_id` non null
- Calcule `start = today - 3 days`, `end = today - 1 day`
- Pour chaque restaurant, insère un job dans `backfill_jobs` (status `pending`, vague `'daily'`)
- `uber-backfill-worker` existant dépile la file (rien à modifier côté worker)

### Cron worker (tick)
```sql
SELECT cron.schedule(
  'uber-backfill-worker-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://akcicojkrzeirffefdet.supabase.co/functions/v1/uber-backfill-worker',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

### Sécurité anti-collision
- Clé unique sur `order_id` côté table `orders` → `ON CONFLICT` empêche les doublons même si plusieurs jobs couvrent la même journée
- `pick_next_backfill_job` est atomique (verrouillage row-level) → 2 workers en parallèle ne piquent jamais le même job
- Token Uber `client_credentials` mis en cache 30 jours → pas de rate-limit OAuth

## Hors scope

- Recodage du parser CSV (déjà OK)
- Modification des RPC analytics (déjà OK)
- Rattrapage des historiques mensuels manquants pour les Tasty Crousty (étape 5, à traiter séparément)
