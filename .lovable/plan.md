## Faisabilité

**Oui, c'est possible**, avec deux nuances importantes à acter dès maintenant :

1. **Le webhook `orders.notification` d'Uber Eats ne fournit qu'un payload partiel** (id de commande, store, statut, total brut TTC). Pas de TVA, pas de promo, pas de commission Uber, pas de net payout. C'est précisément pourquoi la rentabilité reste impossible en live — vous l'avez déjà acté. Le live sera donc **"compteur de commandes + CA brut estimé"**, rien de plus.
2. **L'écriture du webhook dans le dashboard Uber Developer** (étape "configurer l'URL `orders.notification`") n'est pas automatisable depuis Lovable : c'est une action manuelle dans le portail Uber. Je fournirai l'URL exacte à coller, mais le clic final vous revient.

---

## Phase 1 — Live (webhook temps réel)

### 1.1 Nouvelle table `uber_live_orders`

Migration créant la table + GRANTs + RLS + index :

```text
uber_live_orders
├─ id (uuid, pk)
├─ uber_order_id (text, unique)
├─ restaurant_id (uuid, FK restaurants)
├─ uber_store_id (text)
├─ chain_id (uuid)
├─ status (text)              -- CREATED, ACCEPTED, DELIVERED, CANCELED…
├─ gross_amount_incl_vat (numeric)
├─ currency (text, default 'EUR')
├─ order_placed_at (timestamptz)
├─ last_event_at (timestamptz) -- met à jour à chaque webhook
├─ consolidated (bool, default false) -- bascule true quand `orders` couvre la date
├─ raw_payload (jsonb)
├─ created_at / updated_at

Index : (restaurant_id, order_placed_at desc), (chain_id, order_placed_at desc), (consolidated, order_placed_at)
RLS : lecture via has_chain_access(chain_id), écriture service_role uniquement.
```

### 1.2 Nouvelle edge function `uber-orders-webhook`

- Endpoint public (`verify_jwt = false`), CORS standard.
- Valide la signature `X-Uber-Signature` (HMAC SHA-256 avec le secret `UBER_WEBHOOK_SIGNING_KEY` qu'Uber affiche dans le dashboard).
- Résout `restaurant_id` + `chain_id` via `uber_store_id` (jointure `restaurants` / `restaurant_uber_ids`).
- `upsert` sur `uber_order_id` (chaque commande peut recevoir plusieurs events : created → accepted → delivered).
- Log dans `webhook_logs` (déjà existant) pour debug.
- Réponse 200 immédiate, traitement asynchrone.

Secret à demander : **`UBER_WEBHOOK_SIGNING_KEY`** (vous le récupérez dans le dashboard Uber au moment de créer le webhook). Je le demanderai via `add_secret` au moment du build.

### 1.3 Configuration côté Uber (action manuelle)

URL à coller dans le dashboard Uber Developer → Webhooks → `orders.notification` :

```
https://akcicojkrzeirffefdet.supabase.co/functions/v1/uber-orders-webhook
```

Événements à cocher : `orders.notification`, `orders.status_changed` (et `orders.cancel` si disponible).

---

## Phase 2 — Consolidation automatique J+2

### 2.1 Créer le pg_cron manquant pour `uber-daily-backfill-trigger`

Aujourd'hui la fonction existe mais **aucun pg_cron ne l'appelle** (c'est la cause du trou 22-24 juin). Création du job :

```text
Nom    : uber-daily-backfill
Cron   : 0 5 * * *   (5h00 UTC chaque jour)
Action : POST https://<projet>/functions/v1/uber-daily-backfill-trigger
```

Inséré via le tool `insert` (pas migration — contient l'anon key projet-spécifique).

### 2.2 Marquage de consolidation

Quand le worker termine un `PAYMENT_DETAILS_REPORT` + `ORDER_HISTORY_REPORT` pour une date D :

- Trigger SQL (ou hook dans `parse-payment-report` / `parse-report-csv`) qui exécute :
  ```text
  UPDATE uber_live_orders
  SET consolidated = true
  WHERE restaurant_id = $1
    AND date(order_placed_at AT TIME ZONE 'Europe/Paris') = D;
  ```
- Les hooks de lecture (cf. UI ci-dessous) basculent automatiquement de `uber_live_orders` (consolidated=false) vers `orders` (consolidated=true) selon le flag.

Pas de purge des `uber_live_orders` : on les garde 30 jours pour audit, puis cron de nettoyage hebdo (job pg_cron secondaire).

---

## Phase 3 — UI bloc "Aujourd'hui" sur l'onglet Uber Eats

### 3.1 Nouveau hook `useUberLiveToday`

Requête sur `uber_live_orders` filtré par `restaurantIds` actifs + `date(order_placed_at AT TIME ZONE 'Europe/Paris') = CURRENT_DATE Paris`. Retourne :

- `ordersCount`
- `grossRevenueEstimate`
- `lastEventAt`
- `isConsolidated` (true si toutes les lignes du jour ont `consolidated=true`)

Realtime Supabase activé sur la table → les chiffres se mettent à jour sans refresh.

### 3.2 Composant `UberLiveTodayCard`

Placé en haut de la vignette Uber Eats sur `/overview` quand le canal Uber Eats est sélectionné (et masqué sur "Vue réseau" pour éviter la confusion avec les autres canaux non-live).

```text
┌─────────────────────────────────────────┐
│  Uber Eats — Aujourd'hui      [● Live]  │
│                                          │
│  142 commandes                           │
│  2 847 € CA brut estimé                  │
│                                          │
│  Dernière commande il y a 2 min          │
│  ⓘ Données live, consolidation à J+2     │
└─────────────────────────────────────────┘
```

Badges :
- `● Live` (vert, animé) tant qu'`isConsolidated = false`.
- `✓ Consolidé J+2` (gris) une fois la bascule effectuée (utile sur les vues J-1/J-2).

### 3.3 Réutilisation sur la vignette "Hier"

Sur la vue "Hier", afficher le badge `Données partielles — consolidation J+2` tant que `consolidated=false` pour cette date, pour expliquer le 18 601 € observé aujourd'hui.

---

## Ordre d'exécution proposé (build mode)

1. **Migration SQL** : table `uber_live_orders` + GRANTs + RLS + index + fonction trigger de consolidation.
2. **Demande du secret** `UBER_WEBHOOK_SIGNING_KEY` (via `add_secret`).
3. **Edge function** `uber-orders-webhook` (signature, upsert, logs).
4. **Insertion pg_cron** pour `uber-daily-backfill-trigger` (5h00 UTC).
5. **Insertion pg_cron** secondaire pour nettoyage `uber_live_orders` (hebdo).
6. **Hook** `useUberLiveToday` + composant `UberLiveTodayCard` + intégration dans `Overview.tsx` + ChannelBreakdownPanel.
7. **Rattrapage manuel** des dates 22-24 juin (jobs `PAYMENT_DETAILS_REPORT` + `ORDER_HISTORY_REPORT` × 172 restos).
8. **Vous** : coller l'URL webhook dans le dashboard Uber Developer et activer `orders.notification`.

## Détails techniques

- **Multi-tenant** : résolution `chain_id` au moment du webhook → respect du standard `useActiveRestaurants` + `has_chain_access`.
- **Idempotence** : `upsert` sur `uber_order_id` empêche les doublons si Uber retente.
- **Timezone** : agrégation "Aujourd'hui" en `Europe/Paris`, conformément à la mémoire projet.
- **Sentinel UUID** : le hook live respecte la garde `analytics ready` standard.
- **Sécurité** : refus 401 si signature HMAC invalide ; jamais d'écriture sans signature valide.
- **Rate-limit Uber** : aucun risque côté webhook (Uber pousse, on ne tire pas).

## Ce qui reste hors périmètre

- Pas de calcul de rentabilité, commission, net payout, ou TVA en live (impossible avec le payload Uber).
- Pas de support Deliveroo en live (pas d'API webhook équivalente publique).
- Pas de "live" sur Caisse / Dishop dans cette implémentation.