## Test prep time — 1 semaine janvier 2026

### Objectif
Valider la chaîne `ORDER_HISTORY_REPORT` Uber → table `order_history` → RPC `get_prep_time_daily` → page Prep Time, sur un échantillon limité avant de lancer un backfill complet.

### Périmètre du test
- **Rapport Uber :** `ORDER_HISTORY_REPORT`
- **Période :** 2026-01-05 → 2026-01-11 (semaine complète lundi → dimanche)
- **Restaurants :** 172 restos Uber actifs (même périmètre que les autres backfills)
- **Volume estimé :** ~172 rapports (1 fenêtre de 7 jours × 172 stores)

### Étapes
1. Lancer la fonction `uber-backfill-reports` avec :
   ```json
   { "reportType": "ORDER_HISTORY_REPORT",
     "startDate": "2026-01-05",
     "endDate": "2026-01-11",
     "label": "Test prep time semaine 2 janvier 2026" }
   ```
2. Attendre le traitement webhook (10–30 min).
3. Vérification SQL :
   ```sql
   SELECT date_trunc('day', order_datetime) d,
          COUNT(*) nb,
          ROUND(AVG(initial_prep_time_minutes)::numeric, 2) avg_prep
   FROM order_history
   WHERE order_datetime BETWEEN '2026-01-05' AND '2026-01-12'
   GROUP BY 1 ORDER BY 1;
   ```
4. Ouvrir la page Prep Time / `PrepTimeComparison` sur la semaine du 5 janvier pour valider l'affichage.

### Décision après test
- Si la data remonte correctement → backfill élargi (à définir : Q1 2026, ou jan→juin).
- Si vide ou anormal → diagnostiquer parseur `parse-order-history` ou disponibilité du rapport côté Uber.

### Hors scope
- Aucune modification de code, schéma, RLS.
- Pas de modification de la page Prep Time.
