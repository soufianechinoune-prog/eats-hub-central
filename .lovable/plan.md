## Contexte

La page `/admin/uber-backfill-ca` est censée rattraper le **CA** historique Uber. Aujourd'hui, elle envoie en réalité du `ORDER_HISTORY_REPORT` (vague = 6, via la RPC `enqueue_order_history_backfill`), qui est **bloqué à 188 jours** par Uber. C'est pour ça que les mois antérieurs sont grisés "hors fenêtre API".

Or, le seul rapport pertinent pour le CA — `PAYMENT_DETAILS_REPORT` — n'a **aucune limite de date**. C'est ce qui a permis de remonter Bonneuil jusqu'à janvier 2024.

## Objectif

Rendre tous les mois éligibles à un rattrapage API sur cette page **uniquement** via `PAYMENT_DETAILS_REPORT`, sans toucher aux autres vagues (qui restent à juste titre limitées à 188 jours).

## Changements

### 1. Nouvelle RPC SQL `enqueue_payment_details_backfill`
Migration SQL ajoutant une fonction quasi-identique à `enqueue_order_history_backfill` mais :
- `report_type = 'PAYMENT_DETAILS_REPORT'`
- `vague = 1`
- **Aucun filtre `v_min_date` / 188 jours** : on accepte tous les mois depuis l'ouverture du restaurant
- Toujours `SECURITY DEFINER` + `is_super_admin()` guard
- `ON CONFLICT` sur la même contrainte unique (resto + mois + type) → relance propre des jobs déjà existants

L'ancienne fonction `enqueue_order_history_backfill` n'est pas modifiée (elle reste utile aux autres pages qui ciblent l'opérationnel).

### 2. Page `src/pages/UberBackfillCA.tsx`
- Appeler la nouvelle RPC `enqueue_payment_details_backfill` au lieu de `enqueue_order_history_backfill`.
- Lire les jobs sur `vague = 1` au lieu de `vague = 6` (queries `backfill-jobs-resto`, `backfill-done-by-resto`, `backfill-throughput`, `cancelPending`).
- Supprimer la constante `UBER_API_WINDOW_DAYS`, `MIN_API_DATE`, `isInApiWindow` et tous les blocages associés (`togglePick`, `pickAllCsv`, `pickYear`).
- Retirer la bannière jaune "⚠️ Limite Uber : API 188 jours max" (elle est fausse pour ce rapport).
- Ajuster le sous-titre : remplacer "6 derniers mois" par "tout l'historique disponible (depuis l'ouverture du restaurant)".
- Le compteur "X/6" sur la liste des restos doit s'adapter au nombre de mois réellement enqueue (passer de "/6" à "/{actionable}" basé sur les jobs existants, ou simplement afficher `done` sans dénominateur fixe).

### 3. Ce qui ne bouge PAS (important)
- **Worker `uber-backfill-worker`** : il route déjà sur n'importe quel `report_type` stocké en base. Aucune modif. Sa logique d'auto-skip "188 days" reste en place — elle ne se déclenchera juste plus pour PAYMENT_DETAILS.
- **Edge function `uber-create-report`** : déjà agnostique au type.
- **Pages `UberBackfillHistorique` et `UberBackfill`** : intactes. Les vagues 2-6 (opérationnel) gardent leur limite naturelle.

## Garanties demandées par l'utilisateur

- ✅ On n'envoie **que** `PAYMENT_DETAILS_REPORT` depuis cette page → aucun risque d'erreur "188 days".
- ✅ Aucun autre type de rapport n'est déclenché par les boutons de cette page.
- ✅ Si Uber renvoyait quand même une erreur sur un mois trop ancien (resto inexistant à cette date), le worker la marquera proprement en `failed` avec le message d'origine — pas de boucle infinie.

## Détail technique (référence)

```text
Avant :  CA page → enqueue_order_history_backfill → vague 6 / ORDER_HISTORY_REPORT → bloqué 188j ❌
Après :  CA page → enqueue_payment_details_backfill → vague 1 / PAYMENT_DETAILS_REPORT → illimité ✅
```

Migration SQL minimale :
```sql
CREATE OR REPLACE FUNCTION public.enqueue_payment_details_backfill(
  p_restaurant_id uuid, p_months date[]
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- même corps que enqueue_order_history_backfill
-- MAIS : pas de v_min_date, report_type='PAYMENT_DETAILS_REPORT', vague=1
$$;
GRANT EXECUTE ON FUNCTION public.enqueue_payment_details_backfill(uuid, date[]) TO authenticated;
```
