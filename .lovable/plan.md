
# Backfill historique Uber — stratégie en 3 vagues

## Pourquoi pas tout d'un coup

- **169 restaurants** ont un `uber_store_id` configuré
- Janvier 2024 → aujourd'hui = **23 mois** → **~3 887 rapports** à générer pour le seul `PAYMENT_DETAILS_REPORT`
- Le pipeline n'a jamais traité plus de quelques rapports en parallèle (5 completed à date)
- Risques concrets d'un backfill massif :
  - Rate limit Uber (limite réelle inconnue, le throttle 300ms est arbitraire)
  - Webhooks asynchrones qui reviennent en désordre sur plusieurs jours
  - Beaucoup de restos pas connectés en 2024 → rapports vides massifs
  - Si ça plante, distinguer "Uber n'a pas de data" vs "webhook perdu" sur 4 000 jobs = ingérable

## Approche : 3 vagues avec checkpoint après chacune

### Vague 1 — Validation pipeline (1 resto, 6 mois)
- **Cible** : Chicken Street Besançon, juillet → décembre 2025
- **Volume** : 6 rapports `PAYMENT_DETAILS_REPORT`
- **Durée** : ~30 min (génération Uber + webhook + parsing)
- **Checkpoint** :
  - 6/6 rapports en `completed` ?
  - Commandes bien insérées dans `orders` (volume cohérent) ?
  - Pas de doublons ?
- **Si KO** → on corrige avant d'aller plus loin

### Vague 2 — Validation multi-restaurant (10 restos, 3 mois)
- **Cible** : 10 restos clairement actifs (sélection sur volume de commandes récent), octobre → décembre 2025
- **Volume** : 30 rapports
- **Durée** : ~1-2h
- **Checkpoint** :
  - Taux de complétion (objectif >95%)
  - Détection des restos qui retournent du vide (à exclure de la vague 3)
  - Stress du webhook (10 webhooks en parallèle ≈ pic du backfill final)
- **Si KO** → on ajuste throttling ou retry logic

### Vague 3 — Backfill complet, mois par mois
- **Cible** : 169 restos × 23 mois (janv. 2024 → mars 2026), **un mois à la fois**
- **Volume** : ~169 rapports par batch, 23 batches
- **Durée** : étalé sur 2-3 jours, batch par batch avec contrôle entre chaque
- **Checkpoint après chaque mois** :
  - Vue tableau : restos completed / pending / failed
  - Bouton "rejouer les failed du mois X"
  - On ne lance le mois suivant que si le mois courant est >90% completed

## Ce qu'il faut construire

### 1. Page admin `/admin/uber-backfill`
Tableau de bord pour piloter les 3 vagues (réservé super_admin) :
- Sélecteur de mode : **Vague 1** / **Vague 2** / **Vague 3 (mois X)**
- Sélecteur de restos (auto-rempli selon la vague, modifiable)
- Sélecteur de période (preset par vague, modifiable)
- Sélecteur de type de rapport (défaut `PAYMENT_DETAILS_REPORT`)
- Bouton "Lancer la vague"
- Tableau live de l'état des `reports` créés : status (pending/completed/failed), nb commandes parsées, durée

### 2. Édition de l'edge function `uber-backfill-reports`
- Ajouter le paramètre `dryRun` pour estimer le volume sans appeler Uber
- Logger chaque batch dans une nouvelle table `backfill_runs` (id, vague, started_at, finished_at, total, ok, failed, params)
- Réduire le throttle à 500ms entre appels (plus safe que 300ms sur du gros volume)
- Retry automatique 1 fois sur erreur 429 (rate limit) avec backoff de 5s

### 3. Vue "rapports orphelins"
Sur la même page admin, tableau des rapports `pending` depuis >2h avec :
- Bouton "rejouer le webhook" (pour rapports où Uber a répondu mais qu'on a perdu)
- Bouton "marquer failed" (pour ceux qu'Uber n'a jamais générés)

### 4. Détection automatique des restos inactifs (optionnel mais utile)
Avant la vague 3, fonction qui pour chaque resto identifie le **mois de première activité Uber** (premier rapport non-vide), et qui exclut automatiquement les mois antérieurs des batches suivants. Évite de générer ~1000 rapports vides.

## Détails techniques

```text
backfill_runs (nouvelle table)
├── id uuid pk
├── vague text                  -- 'v1' | 'v2' | 'v3-2024-01' | ...
├── report_type text
├── restaurant_ids uuid[]
├── start_date / end_date date
├── status text                 -- 'running' | 'completed' | 'failed'
├── total / ok / failed int
├── started_at / finished_at timestamptz
└── triggered_by uuid           -- super_admin user_id
```

Ordre d'implémentation :
1. Table `backfill_runs` (migration)
2. Édition de `uber-backfill-reports` (logging + retry + dryRun)
3. Page `/admin/uber-backfill` (UI pilotage + tableau live)
4. **Lancement vague 1** → on regarde ensemble le résultat avant de coder la suite
5. Si vague 1 OK → vague 2
6. Si vague 2 OK → on ajoute la détection auto restos inactifs + on lance la vague 3 mois par mois

## Ce qu'on ne fait PAS dans ce plan
- On reste sur `PAYMENT_DETAILS_REPORT` uniquement. Les 4 autres types (`ORDER_HISTORY`, `DOWNTIME`, `CUSTOMER_FEEDBACK`, `MENU_ITEM_FEEDBACK`) seront testés dans un second temps, une fois le backfill financier validé. Sinon on multiplie le volume par 5.
- Pas de déduplication transverse pour l'instant : on s'appuie sur les contraintes uniques existantes des tables `orders` / `payouts`.

## Question pour toi
Est-ce que je pars sur ce plan, ou tu veux ajuster le découpage des vagues (ex: démarrer plus large dès la vague 1) ?
