## Problème

- Uber pousse bien les événements `orders.notification` (visible dans les logs en temps réel).
- Mais ils tombent sur **`uber-report-webhook`** (l'ancien handler, dédié aux rapports CSV), qui les rejette avec `"Ignoring non-success event"`.
- La nouvelle fonction `uber-orders-webhook` n'a **jamais été appelée** (0 log).
- Conséquence : la table `uber_live_orders` reste vide → carte "Uber Eats" à 0 €.

## Cause probable

Uber Developer Dashboard a une seule URL de webhook active au niveau de l'application, et c'est toujours l'ancienne (`uber-report-webhook`). Le changement vers `uber-orders-webhook` visible dans ta capture n'a pas pris effet côté livraison, OU il s'applique à un autre environnement.

## Solution : fusionner les 2 handlers dans `uber-report-webhook`

Au lieu de re-configurer Uber, on enrichit le webhook qui reçoit déjà le trafic.

### 1. Modifier `supabase/functions/uber-report-webhook/index.ts`

Après la validation HMAC, router selon `event_type` :

- `report.success` / `report.failure` → comportement actuel (parsing CSV, mise à jour `backfill_jobs`).
- `orders.notification` → nouveau : récupérer l'order via l'API Uber (`GET /v2/eats/order/{order_id}`), upsert dans `uber_live_orders` (résolution `restaurant_id`/`chain_id` via `restaurant_uber_ids`).
- Tout autre event → ignorer silencieusement (200 OK).

La logique de fetch + upsert est déjà écrite dans `uber-orders-webhook` — on la déplace.

### 2. Garder `uber-orders-webhook` en backup

On le laisse déployé (au cas où Uber bascule), mais il devient redondant. Pas de suppression nécessaire.

### 3. Vérification

- Attendre 1-2 commandes Uber (les events arrivent toutes les secondes).
- Vérifier `SELECT COUNT(*) FROM uber_live_orders WHERE order_placed_at >= now() - interval '5 min'` → doit grimper.
- La carte "Uber Eats" sur `/live` doit afficher du CA dans les 60s suivantes.

### 4. Aucune action côté Uber Dashboard

Pas besoin de changer l'URL, pas besoin de re-signer, pas besoin de toucher au secret.

## Hors-scope

- Modification de la page `/live` (la carte est déjà branchée et auto-refresh).
- Modification du cron `uber-daily-backfill-trigger` (consolidation J+2 séparée).
- Suppression du webhook `uber-orders-webhook`.