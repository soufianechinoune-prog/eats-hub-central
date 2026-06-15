# Réparation sync Splash + Vue journalière live

## Contexte

La sync Splash360 ne fonctionne plus depuis le 7 juin 2026 (8 jours). Les crons tournent (toutes les 30 min en journée, 1h la nuit) mais la fonction `sync-splash360` n'arrive jamais à finaliser : timeout `pg_net` à 5s alors que la sync complète prend 30-90s. Conséquence : `splash360_daily_sales` figé au 7 juin, et 100+ lignes orphelines dans `splash360_sync_runs` avec `status='running'`.

Le besoin "vue journalière live" ne peut donc pas s'implémenter avant d'avoir réparé le pipeline sous-jacent.

## Décalage réel par source (réponse à ta question)

| Source | Mécanisme | Décalage cible après fix |
|---|---|---|
| **Splash360** (caisse + sur place) | API REST + cron | **5–30 min** (live faisable) |
| **Uber Eats** | Rapports CSV générés par Uber post-clôture | **J+1 matin** (limite API Uber) |
| **Deliveroo** | Import CSV manuel hebdo | **J+7** |
| **Dishop** | Cron lundi 06:00 | **J+7** |

Donc le "live" réaliste = Splash uniquement. Uber/Deliveroo/Dishop affichés en J-1/J-7.

## Lot A — Réparer la sync Splash (PRIORITÉ 1, bloquant)

### A1. Découper le workload en deux niveaux

Au lieu d'une sync mensuelle complète à chaque cron, séparer en deux modes :

- **`mode: "today"`** (rapide, ~3–5s) : sync uniquement aujourd'hui + hier, 3 endpoints, tous restos. C'est ce qui tournera toutes les 5–15 min.
- **`mode: "month"`** (lent, 60–90s) : sync complète du mois en cours. Tourne 1× par jour à 4h du matin (consolidation).

### A2. Lancer la sync en arrière-plan (fire-and-forget)

Utiliser `EdgeRuntime.waitUntil(...)` pour que la fonction réponde 200 immédiatement (HTTP < 1s), pendant que le traitement continue côté serveur. Cela règle définitivement le problème de timeout `pg_net`.

```ts
// Pattern
if (sync_all_active) {
  const runId = await initRunRow();
  EdgeRuntime.waitUntil(processAllConnections(runId, body));
  return new Response(JSON.stringify({ ok: true, run_id: runId }), { status: 202 });
}
```

### A3. Augmenter le timeout pg_net en sécurité

Passer `timeout_milliseconds := 30000` sur tous les `net.http_post` Splash (au cas où `waitUntil` ne suffirait pas).

### A4. Reconfigurer les crons

Supprimer les crons existants (`splash360-sync-day`, `splash360-sync-night`, `sync-splash360-daily`) et les remplacer par :

- `splash-sync-live` : toutes les **10 minutes**, 24/7, mode `today` (sync J et J-1)
- `splash-sync-month-catchup` : tous les jours à **04:00 UTC**, mode `month` (rattrape le mois complet, incl. corrections rétroactives)

### A5. Nettoyer les runs zombies

Marquer en `status='failed'` toutes les lignes `splash360_sync_runs` avec `status='running'` et `triggered_at < now() - interval '15 min'`. Ajouter un trigger ou un cron `splash-reset-stuck-runs` toutes les 5 min (équivalent à ce qui existe déjà pour les backfill jobs).

### A6. Backfill des jours manquants (8–15 juin)

Déclencher manuellement `sync-splash360` en `mode: "month"` une fois pour juin 2026 → récupère toutes les données manquantes via upsert.

## Lot B — Vue journalière "Aujourd'hui" (après Lot A validé)

Un nouvel onglet **"Aujourd'hui"** dans `/overview` (à côté de la sélection de période).

### B1. Hook `useTodayLive`

- Source : `splash360_daily_sales` filtré sur `date = CURRENT_DATE` (timezone Paris)
- Refresh automatique : `refetchInterval: 5 * 60_000` (5 min)
- Indicateur visuel : "Dernière sync il y a X min" (basé sur `MAX(updated_at)`)

### B2. Composants UI

- **KPI cards live** : CA TTC du jour (Splash global / Uber / Deliveroo / sur place), nb tickets, panier moyen, comparaison vs même jour semaine dernière
- **Courbe horaire** : revenue par tranche d'heure (basée sur `granularity='hour'` si disponible côté Splash, sinon dégradé)
- **Bandeau d'état par source** :
  - Splash : 🟢 "Live • dernière sync il y a 7 min"
  - Uber : 🟡 "J-1 • données du 14 juin (les commandes d'aujourd'hui seront disponibles demain matin)"
  - Deliveroo : 🔴 "J-7 • dernière import semaine du 8 juin"
- **Bouton "Synchroniser maintenant"** : déclenche `sync-splash360` en mode `today`, désactivé pendant 30s après usage

### B3. Placement

- Onglet "Aujourd'hui" au-dessus de la sélection de période d'Overview, activé par défaut au chargement de la page si l'utilisateur arrive avant 22h
- L'utilisateur peut basculer en mode "Période" pour retrouver les KPIs historiques

## Hors scope

- Ajouter de la granularité horaire côté Splash (à voir si l'API expose ça — pas vérifié encore)
- Scraping Uber Eats Manager pour récupérer les commandes du jour (fragile, à éviter)
- Vue live multi-plateforme avec consolidation (impossible tant que Uber/Deliveroo restent en J+1/J+7)

## Ordre d'exécution

1. **A5 + A6** (5 min) : nettoyer les zombies + backfill juin pour récupérer les données manquantes
2. **A1 + A2 + A3 + A4** (30 min) : refactor `sync-splash360` + reconfig crons → sync stable
3. **Validation 24h** : vérifier que la sync tourne sans interruption
4. **B1 + B2 + B3** : implémenter l'onglet "Aujourd'hui"

Le Lot A est urgent (tu as 8 jours de données manquantes). Le Lot B vient après confirmation que la sync tient.
