## 🎯 Objectif

Récupérer **toutes les commandes Uber Eats** depuis le 01/01/2024 pour les **169 restaurants** ayant un `uber_store_id`, **resto par resto**, en arrière-plan via cron, sans bloquer la plateforme et **sans aucun doublon**.

## ✅ Garantie zéro doublon

La table `orders` a une contrainte UNIQUE :
```
orders_uber_order_flow_unique ON (uber_order_id, uber_flow_id)
```

→ Toute commande déjà importée (CSV ou API précédente) est **automatiquement ignorée** par Postgres lors du `INSERT ... ON CONFLICT DO NOTHING`. Aucun risque, même si on relance plusieurs fois sur les mêmes périodes.

## ⚙️ Contrainte Uber API

L'endpoint `eats/report` accepte des plages, **mais on a observé en pratique que Uber limite à ~30 jours par rapport** (rapports plus longs = échec ou troncature). On découpera donc chaque resto en **fenêtres mensuelles**.

→ Pour 169 restos × ~28 mois = **~4 700 rapports** à générer au total.

## 📐 Architecture

```text
┌─────────────────────────────────────────────────────┐
│  TABLE backfill_jobs (queue persistante)            │
│  - restaurant_id, month_start, month_end            │
│  - status: pending | running | done | failed        │
│  - attempts, last_error, completed_at               │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  CRON pg_cron (toutes les 2 min)                    │
│  → appelle uber-backfill-worker                     │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  EDGE uber-backfill-worker                          │
│  1. Pick 1 job pending (ordre: resto, mois ASC)     │
│  2. Mark running                                    │
│  3. Call uber-create-report (mois en cours)         │
│  4. Wait completion (polling webhook table)         │
│  5. Mark done OU failed (max 3 retries)             │
│  6. Sleep 3s puis exit (laisse cron reprendre)     │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  UI /admin/backfill-historique                      │
│  - Bouton "Lancer backfill 2024 → today"            │
│  - Heatmap progression resto × mois                 │
│  - Logs en temps réel                               │
│  - Bouton pause/resume                              │
└─────────────────────────────────────────────────────┘
```

## 📋 Étapes d'implémentation

### Étape 1 — Schéma DB (migration)
- Créer table `backfill_jobs` avec colonnes :
  - `id`, `restaurant_id`, `restaurant_name`, `month_start`, `month_end`
  - `status` (pending/running/done/failed/skipped)
  - `attempts` (default 0), `last_error`, `report_id`
  - `started_at`, `completed_at`, `created_at`
- Index sur `(status, restaurant_id, month_start)` pour le picker
- RLS : super_admin only
- Fonction SQL `seed_backfill_jobs(start_date, end_date)` qui génère les jobs pour tous les restos avec `uber_store_id` (~4 700 lignes)

### Étape 2 — Edge function `uber-backfill-worker`
- Picke 1 job `pending` (lock via `UPDATE ... RETURNING` atomique)
- Marque `running`, appelle `uber-create-report` avec la fenêtre mensuelle
- Stocke le `report_id` retourné
- Le webhook `uber-report-webhook` existant ingérera les commandes quand Uber notifiera "succeeded"
- Ajout : extension du webhook pour marquer le job `done` quand le rapport est ingéré
- Si erreur Uber → retry jusqu'à 3 fois, sinon `failed`

### Étape 3 — Cron pg_cron
- Schedule `*/2 * * * *` qui invoque le worker
- Fait avancer la queue 1 job toutes les 2 min
- Estimation totale : 4 700 jobs × 2 min = **~6,5 jours en background** (acceptable, ne bloque rien)
- Possibilité d'augmenter à 1/min si Uber tient le rythme

### Étape 4 — UI super admin `/admin/backfill-historique`
- Page accessible depuis le portail super admin existant
- Stats globales : total jobs, done, running, failed, ETA
- **Heatmap** : 169 restos en lignes × 28 mois en colonnes, couleur selon statut
- Liste des derniers échecs avec `last_error`
- Boutons : "Démarrer", "Pause" (désactive le cron), "Relancer les failed"
- Auto-refresh toutes les 30s

### Étape 5 — Lancement contrôlé
- D'abord **dry-run** : générer les 4 700 jobs en `status=pending` mais cron désactivé
- Validation visuelle dans l'UI (bonne couverture restos × mois ?)
- Puis activation du cron → le backfill démarre

## 🛡️ Sécurité & robustesse

- **Token OAuth caché** (déjà en place via `uber_app_token`, valide 30j) → pas de "too_many_requests"
- **Throttle naturel** : 1 job toutes les 2 min = très en-dessous des limites Uber
- **Idempotent** : relancer un job déjà `done` ne crée aucun doublon (contrainte UNIQUE)
- **Reprise après crash** : un job `running` depuis >30 min est automatiquement remis en `pending`
- **Pas de blocage app** : tout se passe dans des edge functions séparées, n'impacte pas l'UI utilisateur

## 📊 Visualisation finale après backfill

Une fois terminé, tu auras :
- Couverture **100%** des 169 restos depuis leur date d'ouverture sur Uber
- Pas de trous dans les graphes Finance/Overview/Conversion sur 2024-2026
- Un audit log complet (`backfill_jobs`) pour traçabilité

## 🚦 Ordre d'exécution

1. Migration table + seed function
2. Edge function worker
3. Extension du webhook pour marquer jobs `done`
4. UI admin
5. Génération des 4 700 jobs (status=pending, cron OFF)
6. Toi : validation visuelle dans l'UI
7. Toi : clic "Démarrer" → activation cron
8. Background ~7 jours, surveille via UI

**Veux-tu que je lance l'implémentation ?**