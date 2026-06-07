
# Intégration Dishop — Plan par étapes

Architecture multi-tenant pensée pour être réutilisable par toutes tes futures marques clientes, indépendamment du nom commercial du produit.

## Architecture cible

```text
┌─────────────────────────────────────────────────────────────┐
│  Marque Chicken Street (chain_id = uuid-cs)                 │
│  Adresse inbound: dishop-cs-a3f9@inbound.<ton-domaine.io>   │
└─────────────────────────────────────────────────────────────┘
        │                                          ▲
        │ 1. cron hebdo déclenche                  │ 3. email avec zip
        │    POST /Send Company Export             │    arrive ici
        ▼                                          │
┌──────────────────┐         ┌────────────────────────────────┐
│  Dishop API      │ ──────▶ │  Resend Inbound (webhook)      │
│  api.dishop.co   │ email   │  → edge function dishop-       │
└──────────────────┘         │     inbound-handler            │
                             │  → télécharge zip, dézippe,    │
                             │     parse JSON, insère en DB   │
                             └────────────────────────────────┘
                                          │
                                          ▼
                             ┌────────────────────────────────┐
                             │  Tables: dishop_billing,       │
                             │  dishop_orders, dishop_users   │
                             │  (isolées par chain_id)        │
                             └────────────────────────────────┘
                                          │
                                          ▼
                             ┌────────────────────────────────┐
                             │  Dashboards Overview/Finances  │
                             │  + connecteur /settings/       │
                             │  integrations                  │
                             └────────────────────────────────┘
```

---

## ÉTAPE 1 — Connecteur Dishop + authentification (cette itération)

**Objectif :** valider qu'on arrive à parler à l'API Dishop, sans encore traiter les exports.

### Ce qu'on construit
- **Nouveau connecteur "Dishop"** dans `pos_connectors` (à côté de Splash360 et Zelty), avec champs `client_id`, `client_secret`, `company_id`.
- **Carte de connexion** sur `/settings/integrations` : tu saisis les credentials Chicken Street fournis par Nicolas.
- **Edge function `dishop-auth`** : génère un access token via `POST /partner/access_token` avec client_id + client_secret. Token mis en cache 50 min (l'API renvoie une durée de vie, on stocke avec marge).
- **Bouton "Tester la connexion"** : appelle `GET /companies/{company_id}/shops` et affiche le nombre de shops trouvés → preuve que l'auth marche.
- **Bouton "Voir les shops"** : liste les shops Dishop avec leur `shop_id`, nom, adresse → on s'en sert à l'étape 2 pour le mapping.

### Ce que tu valides à la fin de l'étape 1
- ✅ Auth Dishop fonctionne
- ✅ Tu vois la liste des shops Chicken Street remontée par Dishop
- ✅ Tu peux nous dire si les noms correspondent ou s'il faut faire un mapping manuel

---

## ÉTAPE 2 — Domaine technique + réception inbound + parsing Billing

**Objectif :** automatiser la réception des exports et stocker le 1er flux (billing).

### Prérequis côté toi (avant qu'on code)
1. **Acheter le domaine technique** (~12€/an). Suggestions de noms neutres :
   - `delivery-sync.io`
   - `posdata-bridge.io`
   - `restochannel-sync.io`
2. Une fois acheté, le connecter au projet via **Project Settings → Domains** (Lovable gère le DNS si acheté chez nous).

### Ce qu'on construit
- **Configuration Resend Inbound** sur un sous-domaine `inbound.<ton-domaine>.io` (MX + DKIM gérés par Lovable Emails ou Resend selon ce qui est le plus propre).
- **Génération d'adresses uniques par marque** : à la création d'une connexion Dishop, on génère `dishop-{chain_slug}-{token4}@inbound.<domaine>` et on la stocke dans `chain_pos_connections.metadata.inbound_email`. Cette adresse est affichée dans l'UI avec un bouton "Copier" — tu la donnes à Dishop pour qu'ils l'utilisent comme destinataire d'export.
- **Edge function `dishop-inbound-handler`** (webhook Resend) :
  1. Reçoit l'email avec le zip en pièce jointe
  2. Identifie la marque via l'adresse destinataire (token unique → chain_id)
  3. Télécharge le zip dans Supabase Storage (bucket `dishop-exports`)
  4. Le dézippe en mémoire (lib `jszip` côté Deno)
  5. Parse uniquement le dossier `billing` à cette étape
  6. Insère dans la nouvelle table `dishop_billing`
- **Table `dishop_billing`** : `chain_id`, `shop_id` (Dishop), `restaurant_id` (mapping vers `restaurants.id`, NULL si pas encore mappé), `period_start`, `period_end`, `order_charge_id`, `gross_amount`, `commission_fee`, `stripe_fee_fixed`, `stripe_fee_variable`, `net_amount`, `vat`, `fulfillment_type` (delivery/pickup), `raw_payload` (jsonb).
- **Bouton manuel "Déclencher un export maintenant"** : appelle `POST /companies/{id}/billing/export` avec l'adresse inbound de la marque comme destinataire. Utile pour tester sans attendre le cron.
- **UI mapping shops Dishop ↔ restaurants plateforme** sur la page connecteur (auto-match par fuzzy name + correction manuelle, pattern identique à ce qu'on a pour Uber/Deliveroo).

### Ce que tu valides à la fin de l'étape 2
- ✅ Tu cliques sur "Déclencher export", Dishop envoie l'email, on parse, les lignes billing apparaissent dans une nouvelle page "Données Dishop" (vue brute table)
- ✅ Le mapping des shops est fait

---

## ÉTAPE 3 — Orders + Users + intégration analytics

**Objectif :** brancher les données Dishop sur tes dashboards existants.

### Ce qu'on construit
- **Extension du parser** pour les dossiers `order` (commandes détaillées avec items) et `user` (clients).
- **Tables `dishop_orders` et `dishop_users`** :
  - `dishop_orders` : `chain_id`, `restaurant_id`, `dishop_order_id`, `charge_id` (FK logique vers `dishop_billing`), `order_datetime`, `fulfillment_type`, `total_amount`, `items` (jsonb : list de {product_id, name, qty, unit_price}), `raw_payload`.
  - `dishop_users` : `chain_id`, `dishop_user_id`, `email`, `first_name`, `last_name`, `phone`, `newsletter_optin`, `first_order_at`, `last_order_at`, `total_orders`, `raw_payload`.
- **Intégration Overview** : nouveau bandeau "Dishop" (canal web/app direct) à côté d'Uber Eats et Deliveroo, avec CA, nb commandes, panier moyen.
- **Intégration Finances** : ligne "Dishop" dans la grille comptable HT/TVA/TTC, avec décomposition commissions Dishop (12% delivery / 1€ click&collect) + frais Stripe (1,5% + 0,25€).
- **Nouvelle page "Clients Dishop"** (basique pour cette étape) : table paginée avec filtre par marque, export CSV. La vraie CRM viendra plus tard.

### Ce que tu valides à la fin de l'étape 3
- ✅ Le CA Dishop apparaît dans Overview à côté d'Uber/Deliveroo
- ✅ Tu vois les frais Stripe + commissions Dishop dans Finances
- ✅ Tu as accès à la base clients

---

## ÉTAPE 4 — Cron hebdo automatique + supervision

**Objectif :** plus aucune action manuelle.

### Ce qu'on construit
- **Cron pg_cron hebdomadaire** (tous les lundis 06h Paris) qui :
  1. Itère sur toutes les connexions Dishop actives
  2. Pour chacune, calcule la période = semaine S-1 (lundi-dimanche)
  3. Appelle `POST /companies/{id}/billing/export?start=...&end=...&email=<adresse_inbound_marque>`
  4. Log dans `dishop_sync_runs` (statut, période, timestamp)
- **Carte "Historique des syncs Dishop"** sur la page connecteur (calquée sur `SplashSyncRunsCard`).
- **Page de backfill historique** : tu choisis une période (mois par mois, comme Splash), on déclenche N exports manuellement pour rattraper l'historique avant la mise en place du cron.
- **Alertes** : si un export attendu n'est pas reçu sous 24h après le déclenchement, badge orange "Sync en attente" sur la carte.

### Ce que tu valides à la fin de l'étape 4
- ✅ Chaque lundi matin, la data de la semaine précédente est là sans rien faire
- ✅ Tu peux rattraper l'historique 2024-2026
- ✅ Tu vois quand un sync a échoué

---

## Détails techniques (section pour Lovable, pas pour le client)

- **Secrets** : `DISHOP_CLIENT_ID` et `DISHOP_CLIENT_SECRET` stockés au niveau projet ou par marque (à confirmer — si les credentials sont communs à toutes tes marques clientes Dishop, secrets projet ; sinon dans `chain_pos_connections.credentials` chiffré comme pour Splash).
- **Multi-tenant** : toutes les nouvelles tables ont `chain_id` + RLS + grants standards (pattern habituel du projet).
- **Token bucket Storage** `dishop-exports` privé, retention 90 jours pour debug.
- **Index** : `(chain_id, period_start)` sur billing/orders, `(charge_id)` pour les joins.
- **Resend Inbound** : webhook signé HMAC, edge function vérifie la signature avant de traiter.

---

## Ce qu'il me faut de ta part pour démarrer l'étape 1 maintenant

Rien de plus — j'ai les credentials Dishop, je peux commencer immédiatement.

Pour les étapes 2-4, on attendra que tu aies acheté ton domaine technique.
