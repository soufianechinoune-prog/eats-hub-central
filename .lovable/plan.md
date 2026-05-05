## Problème

Deux soucis identifiés sur le backfill historique Uber :

### 1. Jobs `failed` sur les mois de 31 jours
L'API Uber `PAYMENT_DETAILS_REPORT` refuse les plages > 30 jours. Or pour les mois de 31 jours (jan, mars, mai, juil, août, oct, déc) on envoie `month_start` → `month_end` = 31 jours → erreur `bad_request: time range requested must not exceed 30 days`.

Conséquence : ~7 mois sur 12 cassent systématiquement, soit potentiellement **~14 000 jobs voués à l'échec** sur les 24 500 pending.

### 2. Throughput trop lent
Worker = 1 job/minute = ~30 jobs/heure → **~35 jours** pour terminer 24 500 jobs. Trop long.

---

## Correctifs

### Fix 1 — Découper les mois de 31 jours en 2 plages
Dans l'edge function `uber-backfill-worker` (création du rapport Uber) :
- Si `month_end - month_start > 30 jours` → faire **2 appels API** :
  - Plage A : `month_start` → `month_start + 29j`
  - Plage B : `month_start + 30j` → `month_end`
- Télécharger les 2 CSV, les concaténer (ou les parser séquentiellement) avant l'insertion en DB.
- Le job reste 1 ligne en DB, mais consomme 2 rapports Uber côté worker.

Alternative plus simple : forcer `month_end = month_start + 29j` pour tous les jobs (perte d'1 jour par mois sur les mois de 31j). **Moins propre — à éviter**.

### Fix 2 — Réinitialiser les jobs `failed` à `pending`
Migration SQL one-shot :
```sql
UPDATE backfill_jobs 
SET status='pending', attempts=0, last_error=NULL 
WHERE status='failed';
```

### Fix 3 — Augmenter le parallélisme du worker
Deux options :

**Option A (rapide)** : passer le cron de 1 min à **20 secondes** (3 jobs/min) → ~12j de backfill.

**Option B (robuste)** : faire traiter **3 à 5 jobs en parallèle** par tick via `Promise.all` dans la fonction worker (nécessite que `pick_next_backfill_job` accepte un paramètre `limit` et fasse `LIMIT N FOR UPDATE SKIP LOCKED`). → ~5 à 8j de backfill.

Recommandation : **Option B avec 5 jobs en parallèle**. L'API Uber tient largement la charge et le polling (qui représente 80% du temps d'un job) est I/O-bound.

---

## Détail technique

**Fichiers à modifier** :
1. `supabase/functions/uber-backfill-worker/index.ts` :
   - Ajouter helper `splitDateRange(start, end, maxDays=30)` qui retourne `[[s1,e1], [s2,e2]]`
   - Boucler sur les plages pour `createReport` + `pollReport` + `downloadCsv` + parser
   - Wrapper la logique de traitement d'un job dans `processJob(jobId)` puis appeler `Promise.allSettled(jobs.map(processJob))`

2. **Nouvelle migration SQL** :
   - Modifier `pick_next_backfill_job(p_limit int default 1)` → renvoie un `SETOF backfill_jobs` au lieu d'1 ligne, avec `LIMIT p_limit FOR UPDATE SKIP LOCKED`
   - `UPDATE backfill_jobs SET status='pending', attempts=0, last_error=NULL WHERE status='failed'` (reset des 3 actuels + ceux à venir)

3. Le cron pg_cron actuel reste à **1 min** mais chaque tick traite 5 jobs → throughput x5.

---

## Résultat attendu

- 0 job `failed` lié à la limite 30j
- Throughput : ~150 jobs/min → 24 500 jobs en **~3 à 5 jours** au lieu de 35
- Aucun changement UI nécessaire (la page `/admin/uber-backfill-historique` reflète automatiquement les nouveaux statuts)
