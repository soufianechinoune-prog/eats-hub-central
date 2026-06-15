## Objectif

Récupérer via l'API Uber, pour les **344 restaurants Chicken Street + Tasty**, **tous les rapports disponibles** du **1er janvier 2026 à aujourd'hui (≈ J-2)**, en utilisant le worker cron existant (mode lent, ~2 jobs/min) pour éviter tout blocage Uber.

## Périmètre des rapports

6 types de rapports Uber à backfiller :
1. `PAYMENT_DETAILS_REPORT` — Finances, commissions, remboursements (table `payouts`)
2. `ORDER_HISTORY_REPORT` — Temps de préparation, livraison (table `order_history`) ← celui qu'on vient de débloquer
3. `CUSTOMER_AND_DELIVERY_FEEDBACK_REPORT` — Avis clients commande (table `customer_reviews`)
4. `MENU_ITEM_FEEDBACK_REPORT` — Avis sur les plats (table `menu_item_reviews`)
5. `DOWNTIME_REPORT` — Fermetures restaurants (table `downtime_logs`)
6. `ORDER_ERRORS_TRANSACTION_REPORT` — Erreurs commandes (table `order_errors`)

(On laisse de côté `ORDER_ERRORS_MENU_ITEM_REPORT` qui fait doublon avec le précédent côté analytique — on peut le rajouter après si besoin.)

## Volume & timing

- **344 restaurants × 6 fenêtres de 30j × 6 rapports = ~12 384 jobs**
- Worker actuel : 2 jobs/tick, 1 tick/minute → ~120 jobs/h
- **Durée estimée : ~100 heures** (4 jours pleins) en mode worker actuel
- Si on bump le worker à `PARALLEL=3` + tick toutes les 30s : ~25h (1 nuit + 1 journée)

## Plan d'exécution

### Étape 1 — Vérifier l'état du parser pour chaque type

Avant de lancer 12k jobs, confirmer que chaque rapport a un parser FR-aware fonctionnel branché dans `uber-report-webhook`. État actuel :

| Rapport | Parser | Branché ? |
|---|---|---|
| PAYMENT_DETAILS | parse-payment-report | ✅ |
| ORDER_HISTORY | parse-order-history | ✅ (corrigé hier) |
| CUSTOMER_AND_DELIVERY_FEEDBACK | parse-reviews-order | ✅ |
| MENU_ITEM_FEEDBACK | parse-reviews-item | ✅ |
| DOWNTIME | parse-report-csv | ⚠️ à vérifier (parser EN) |
| ORDER_ERRORS_TRANSACTION | parse-report-csv | ⚠️ à vérifier (parser EN) |

→ Action : lancer **1 job test par type** sur 1 seul restaurant, semaine du 6-12 janv, et vérifier que les tables se remplissent. Si DOWNTIME ou ORDER_ERRORS ne parsent rien, on fait un parser FR comme pour les autres avant de lancer la masse.

### Étape 2 — Insérer les 12 384 jobs dans `backfill_jobs`

Script SQL d'insertion :
- Récupérer les `restaurant_id` des chaînes Chicken Street + Tasty avec `uber_store_id` non null
- Pour chaque resto × chaque mois (janv→juin 2026) × chaque report_type → 1 ligne `pending` dans `backfill_jobs`
- Le worker `splitDateRange` découpe automatiquement les mois > 30 jours

Champs : `status='pending'`, `vague='backfill_jan2026_full'`, `report_type=<type>`, `month_start`, `month_end`, `restaurant_id`, `uber_store_id`, `restaurant_name`.

### Étape 3 — Laisser tourner le worker

Le cron `pg_cron` existant appelle déjà `uber-backfill-worker` chaque minute. Aucune action manuelle ; on suit l'avancement avec :

```sql
SELECT report_type, status, COUNT(*) 
FROM backfill_jobs 
WHERE vague='backfill_jan2026_full' 
GROUP BY 1,2 ORDER BY 1,2;
```

### Étape 4 — Validation à mi-parcours (après ~12h)

- Vérifier le ratio done/failed (cible : > 95% done)
- Si beaucoup de `failed` avec rate-limit 429 → réduire `PARALLEL` à 1
- Si beaucoup de `user_not_allowed` → ces restos sont déconnectés, à signaler

### Étape 5 — Cleanup & vérif finale

Une fois tous les jobs en `done` :
- Spot-check sur 5 restos : compter les lignes par table sur la période
- Refresh des pages analytics concernées (Finances, Operations, Avis) pour confirmer l'affichage

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Rate-limit Uber 429 | Retry exponentiel déjà en place (5s→80s, 5 tentatives) |
| Restos déconnectés | Auto-skip après 3 tentatives, log dans `last_error` |
| Webhook qui rate un job | `reset_stale_backfill_jobs` reset les jobs bloqués > 30 min |
| Volume DB d'un coup | Insertion par batch dans `backfill_jobs` (1 transaction de ~12k lignes, OK) |
| Coût credits/edge function | ~12k invocations × ~3 fonctions = ~36k invocations. À surveiller. |

## Hors scope

- Pas de refonte du worker (vitesse actuelle OK puisque "on a la nuit")
- Pas de modif UI
- Pas de nouveau type de rapport au-delà des 6 listés
- Période strictement 2026-01-01 → J-2 (pas d'historique antérieur, ce qui resterait dans la fenêtre 188 jours d'Uber jusqu'à ~juillet)

## Question avant lancement

**Le test étape 1 (1 job par type) prend ~10 minutes** et évite de découvrir au bout de 12h que DOWNTIME ou ORDER_ERRORS ne se parsent pas. Tu valides qu'on le fait avant d'insérer les 12k jobs ?
