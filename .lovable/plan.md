## Bonne nouvelle d'abord : la queue est déjà vide

J'ai compté : **aucune file d'attente** sur les autres vagues. Toutes les vagues 1–5 sont déjà `done` / `failed` / `skipped`. Le seul truc qui tourne c'est ta vague 6 ORDER_HISTORY (1 pending + 1 running pour Reims).

Donc **les 0.03 jobs/min ne sont PAS dus à un encombrement** — c'est la latence Uber elle-même : un ORDER_HISTORY_REPORT prend ~20–40 min côté Uber (création workflow → traitement → webhook → ingestion). Stopper d'autres jobs n'accélèrera rien : il n'y en a pas.

## Réponse sur nov 2025

Tu as 100% raison, ma proposition de "reclasser" était une rustine cosmétique. La vraie cause :

- Aujourd'hui = 14 mai 2026
- 188 jours en arrière = **7 nov 2025**
- Donc Uber accepte toute requête dont `startDate >= 7 nov 2025`
- Le job nov 2025 demande `startDate = 1 nov 2025` → **rejeté** (6 jours trop vieux)

**Ta proposition est meilleure** : ne PAS proposer ce mois en API du tout. On a déjà le CSV de nov 2025, c'est inutile de le rejouer. Il suffit de durcir le filtre d'éligibilité côté UI **et** côté serveur : un mois est éligible API uniquement si **`month_start >= today - 188 jours`** (au lieu de `month_end >=`). Comme ça nov 2025 disparaît tout seul de la liste verte, et les jobs futurs ne pourront même plus être créés pour ce mois.

## Plan

### 1. Durcir l'éligibilité (front + back)
- `src/pages/UberBackfillCA.tsx` : `isInApiWindow` → comparer `month_start` (pas `month_end`) à `today - 188j`
- SQL `enqueue_order_history_backfill` : remplacer le check `v_month_end < v_min_date` par `v_month < v_min_date`
- Effet : oct 2025 et nov 2025 deviennent automatiquement "Hors fenêtre API" en gris ; impossible de les enqueue par accident

### 2. Nettoyer le job nov 2025 actuel
- UPDATE le job `failed` pour Reims nov 2025 → `skipped` avec message standard
- Compteur tombe à `2/6 · 33%`

### 3. Mode "manuel pas-à-pas" (ton workflow préféré)
Tu as **déjà** ce workflow sur la page : choisir 1 resto → cocher 1+ mois → Lancer. Pas besoin d'ajouter de UI. Je propose juste 2 ajouts pour mieux contrôler :

- **Sélecteur de type de rapport** en haut de la fiche resto (dropdown : ORDER_HISTORY / PAYMENT_DETAILS / DOWNTIME / etc.). Aujourd'hui c'est figé sur vague 6 (ORDER_HISTORY). Tu pourras lancer un rapport spécifique sur 1 mois.
- **Bouton "Annuler les jobs pending"** sur la fiche resto (passe les pending de ce resto en `cancelled`) au cas où tu veux changer ta priorité en cours de route.

### 4. Pas de pause globale du worker
Inutile, vu qu'il n'y a rien d'autre en queue. Si un jour tu en relances en masse, on pourra rajouter un toggle global (table `system_settings.worker_paused`).

## Questions avant de coder

1. **Type de rapport au choix** : tu veux le sélecteur sur cette page `/admin/uber-backfill-ca`, ou tu préfères que cette page reste **dédiée à ORDER_HISTORY (CA)** et qu'on en fasse une autre pour les autres rapports ? Mon avis : garder cette page pure CA, et créer plus tard une page sœur si besoin.
2. **Bouton "Annuler pending"** : OK pour l'ajouter ?

Si tu réponds rapidement je code dans la foulée.