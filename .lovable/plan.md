## Diagnostic

**1. Pourquoi "0/24" ?**

Le compteur affiche `done / total` où `total = jobs.length` (limité à 40, triés par `month_start DESC`). Pour Chicken Street - Reims, la DB contient **24 jobs vague=6** :

- **7 pending** (mai 2026 → nov 2025) → vrais jobs API en attente
- **17 skipped** (oct 2025 → juin 2024) → marqués hors fenêtre API par la migration précédente

Donc `0 done / 24 total` = trompeur. Le "24" inclut **les 17 skipped** qui ne seront jamais traités. La vraie progression est `0 / 7`.

Ce n'est PAS "sur 24 mois" — c'est sur 24 lignes en base, dont 17 sont déjà classées sans suite.

**2. Pourquoi le bandeau a "disparu" sur la 2ème capture ?**

Le bandeau est conditionné par `jobs && jobs.length > 0`. Lors du `invalidateQueries` après le clic Lancer, ou pendant un refetch (toutes les 5s), `jobs` peut momentanément revenir `undefined` et le bloc disparaît jusqu'au prochain succès. Pas de bug de fond — flash visuel pendant refetch.

Confirmé par DB : les 7 pending sont bien là, dont **nov 2025 avec `attempts=2` et erreur "startDate must be within 188 days"** → ce mois-là est *à la limite* (1er nov → fin nov = 30 jours d'âge mais début = 195 jours), l'API le refuse partiellement. Le worker va retry et probablement le marquer failed/skipped.

## Plan de correction

**A. Compteur fiable**
Exclure les `skipped` du calcul de progression. Nouveau libellé :
- `Progression : {done} / {actionable} · {pct}%` où `actionable = done + running + pending + failed`
- Sous-ligne : `· 17 hors fenêtre (CSV)` quand il y a des skipped, en muted

**B. Anti-flash du bandeau**
Ajouter `placeholderData: (prev) => prev` (keepPreviousData) sur la query `backfill-jobs-resto` pour éviter la disparition pendant les refetch de 5s.

**C. Cas "nov 2025" limite**
Côté serveur (`enqueue_order_history_backfill` + worker), durcir : si la fin du mois est < `current_date - 188 days` OU si Uber renvoie l'erreur 188 jours, marquer le job `skipped` automatiquement avec le message standard, pas de retry infini. Le job nov 2025 actuel sera nettoyé au prochain run.

**D. Détail visuel (optionnel)**
Dans la liste de jobs, afficher les `skipped` en gris léger sous un sous-titre "Couverts par CSV" pour qu'ils ne polluent pas la lecture.

## Fichiers touchés

- `src/pages/UberBackfillCA.tsx` — compteur + keepPreviousData + section skipped séparée
- migration SQL — durcir le worker `process_order_history_backfill` (auto-skip sur erreur 188j)

Pas de changement de logique métier ni d'impact sur le CA affiché ailleurs.