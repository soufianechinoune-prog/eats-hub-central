# Étape 2 — Import automatique des exports hebdomadaires Dishop

## Ce qu'on construit

Un pipeline qui télécharge chaque semaine le ZIP de comptabilité Dishop (`/v1/api/{companyId}/export-weekly-data/accounting-report`), le décompresse et importe les 3 fichiers dans la base, en isolant strictement par marque. Plus la page de mapping `shopId Dishop → restaurant_id` dans `/settings/integrations`.

## Schéma BDD (4 nouvelles tables, toutes isolées par chain_id)

```text
dishop_shop_mapping        dishop_sync_runs            dishop_customers
─ id (pk)                  ─ id (pk)                   ─ id (pk)
─ chain_connection_id      ─ chain_connection_id       ─ chain_id
─ chain_id                 ─ year, month, week_index   ─ dishop_customer_id (unique)
─ dishop_shop_id (unique)  ─ status, started_at        ─ email, first_name, last_name
─ restaurant_id            ─ files_meta jsonb          ─ phone, country_code
─ raw_label                ─ rows_inserted             ─ first_order_date
                           ─ error_message             ─ newsletter, shop_ids[]
                                                       ─ raw jsonb

dishop_orders                       dishop_order_items
─ id (pk)                           ─ id (pk)
─ chain_id                          ─ dishop_order_id (fk)
─ restaurant_id                     ─ chain_id, restaurant_id
─ dishop_shop_id (raw fallback)     ─ category_id, category_name
─ charge_id (unique)                ─ product_key, item_key, item_name
─ order_number                      ─ section_key (customSplashIngredients…)
─ customer_id                       ─ nb, unit_price, ref
─ order_date (timestamptz Paris)    ─ position_in_basket
─ order_type (delivery/click_and_collect)
─ payment_type, status
─ price_total, commission_dishop_pct, commission_dishop_amount
─ commission_dishop_type (variable+fixe)
─ marketing_promo_used bool
─ address jsonb (city, postal, lat/lng)
─ raw_order jsonb, raw_billing jsonb
```

Triggers d'isolation cross-brand (mêmes que Splash) : rejet en `BEFORE INSERT/UPDATE` si `restaurant.chain_id ≠ chain_connection.chain_id`.

RLS : `chain_id` doit appartenir à l'utilisateur via `user_chain_access` (mêmes patterns que `splash360_*`).

## Edge functions

### `dishop-sync-week` (nouvelle)
Params : `chain_connection_id`, `year`, `month`, optionnel `week_index`.
1. Crée un `dishop_sync_runs` (status=`running`).
2. Récupère token + appelle `accounting-report` → URL signée GCS.
3. Télécharge ZIP, décompresse les 3 JSON via JSZip.
4. Upsert `dishop_customers` (par `dishop_customer_id`).
5. Pour chaque commande dans `orders_*.json` : résout `restaurant_id` via `dishop_shop_mapping` ; upsert dans `dishop_orders` (clé : `charge_id`) + flatten les `commande[*].items[*].options[*]` dans `dishop_order_items` (delete+reinsert par `dishop_order_id`).
6. Enrichit avec les `billings_*.json` (commissions, paymentType, status) en joinant sur `chargeId`.
7. Met à jour le run avec compteurs + status `success` / `failed`.

### `dishop-api` (extension du mode `inspect_zip` existant)
Nouveau mode `probe_history` : sonde 4 variantes pour découvrir comment demander une semaine passée — `?week=YYYY-Www`, `?date=YYYY-MM-DD`, `/weeks/{index}`, `/year/{Y}/month/{M}/week/{W}`. Renvoie status + premier KB de chacune pour qu'on identifie le pattern.

### `dishop-list-shops` (étape de mapping)
À partir de la 1re semaine importée, fait un `SELECT DISTINCT dishop_shop_id, count(*)` côté DB (ou parse à la volée le 1er ZIP) pour proposer les shopIds non encore mappés.

## UI dans `/settings/integrations`

Sur la carte Dishop, sous "Voir les shops" / "Diag accounting" :
1. **Bouton "Découvrir les shops"** → liste les `shopId` détectés dans le dernier ZIP.
2. **Section "Mapping des restaurants"** : tableau `Dishop shopId | Restaurant` (Select des restos de la marque active). Sauve dans `dishop_shop_mapping`. Affiche les shops orphelins en rouge.
3. **Section "Imports"** : 
   - Bouton "Importer cette semaine" (semaine en cours).
   - Bouton "Sonder l'historique" (mode `probe_history`, affiche les réponses).
   - Liste des `dishop_sync_runs` récents avec status + nb lignes.
4. **Bandeau RGPD** : avertit que les données clients (email, téléphone) sont importées et chiffrées au repos.

## Backfill historique

Étape conditionnée au résultat du sondage : si Dishop accepte un param de semaine/date, on ajoute un bouton "Backfill 12 dernières semaines" qui boucle `dishop-sync-week` sur les périodes passées. Sinon, on documente le besoin de remonter l'info à Dishop et on se contente de la semaine courante (job cron hebdo dimanche soir 23h Paris).

## Sécurité / isolation

- Aucun appel direct au service_role depuis le frontend : tout passe par l'edge function.
- `dishop_shop_mapping.restaurant_id` doit appartenir à la même `chain_id` que `chain_connection_id` (trigger BEFORE INSERT).
- Toutes les RLS : `TO authenticated` + `has_chain_access(chain_id)`.
- Données clients : table à part avec RLS stricte, jamais exposée en `SELECT` côté `anon`.

## Détails techniques

- Pagination : insertion par chunks de 500 (limite Postgres pour upsert).
- TZ : `order_date` parsé en `Europe/Paris` avant stockage (cohérent avec `mem://analytics/standard-gestion-horaire`).
- Mémoire à mettre à jour : nouvelle entrée `mem://integrations/dishop-weekly-sync-architecture` + remplacement de `mem://integrations/dishop-api-state` (obsolète, l'API marche).

## Ordre de livraison proposé

1. Migration BDD (4 tables + triggers + RLS).
2. Edge function `dishop-sync-week` + extension `probe_history`.
3. UI mapping shops + bouton import.
4. UI historique des runs + bandeau RGPD.
5. (Conditionnel) cron hebdo + backfill multi-semaines selon résultat sondage.

J'attends ton OK pour démarrer la migration BDD (étape 1).
