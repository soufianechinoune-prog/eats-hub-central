Plan de déploiement du mode live Uber Eats

1. Générer et stocker la clé de signature webhook
   - Créer `UBER_WEBHOOK_SIGNING_KEY` : clé HMAC aléatoire de 64 caractères.
   - Afficher la valeur à l'utilisateur pour qu'il la colle dans le champ Signing Key du dashboard Uber Developer.

2. Déployer la fonction Edge `uber-orders-webhook`
   - Créer `supabase/functions/uber-orders-webhook/index.ts`.
   - Valider la signature HMAC via `UBER_WEBHOOK_SIGNING_KEY`.
   - Parser le payload `orders.notification` (order_id, store_id, status, prix TTC, date).
   - Insérer/mettre à jour `uber_live_orders` (idempotent via `uber_order_id`).
   - Résoudre `restaurant_id` via `restaurant_uber_ids` et `chain_id` via `restaurants`.

3. Activer le cron quotidien de consolidation
   - Créer une migration SQL ajoutant `pg_cron` pour appeler `uber-daily-backfill-trigger` tous les jours à 05:00 UTC.
   - S'assurer que le cron planifie les 7 types de rapports nécessaires (Paiements, Commandes, Avis, Menu, Erreurs, Downtime).

4. Marquer les commandes live comme consolidées
   - Lors de l'import du rapport ORDER_HISTORY_REPORT, matcher les `uber_order_id` existants dans `uber_live_orders` et passer `consolidated = true`.

5. UI : bloc "Aujourd'hui" sur l'onglet Uber Eats de l'Overview
   - Créer `useUberLiveToday.ts` pour agréger les données live du jour (CA TTC, nb commandes, panier moyen) depuis `uber_live_orders`.
   - Créer `UberLiveTodayCard.tsx` avec badge "Live" vert et "Consolidé J+2" gris.
   - Intégrer la carte dans `Overview.tsx` uniquement quand le canal actif est Uber Eats et que la période est aujourd'hui / hier.

6. Vérifications
   - Déployer la fonction Edge.
   - Tester avec un appel curl simulant un webhook Uber (signature HMAC correcte).
   - Vérifier que la page Overview affiche bien les métriques live.