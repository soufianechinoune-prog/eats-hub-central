# CS Delivery Performance — Contexte Projet

## Vue d'ensemble

**CS Delivery Performance** est une plateforme SaaS B2B d'analytics et de pilotage pour réseaux de franchise restauration rapide. Elle agrège les données de plusieurs canaux de vente (Uber Eats, Deliveroo, caisse, commande en ligne) pour donner une vision consolidée aux franchiseurs et franchisés.

**URL production** : https://cs-delivery-performance.com  
**Stack** : React + TypeScript, Vite, Supabase (DB + Edge Functions), Tailwind CSS, shadcn/ui  
**Repo GitHub** : https://github.com/soufianechinoune-prog/eats-hub-central  

---

## Clients actuels

| Chaîne | Restaurants | Statut |
|--------|-------------|--------|
| **Chicken Street** | ~103 actifs (107 total) | ✅ Actif |
| **Tasty Crousty** | ~62 restaurants | ✅ Actif |
| **Bangkok Factory** | 20+ restaurants | 🔄 Contrat en finalisation |
| **Crousty One** | 25+ restaurants | 🔄 En négociation |

---

## Architecture technique

### Frontend
- React 18 + TypeScript
- Vite comme bundler
- Tailwind CSS + shadcn/ui pour les composants
- Framer Motion pour les animations
- React Query pour la gestion des données async
- Recharts pour les graphiques

### Backend (Supabase)
- **Base de données** : PostgreSQL avec RLS (Row Level Security)
- **Edge Functions** : Deno/TypeScript (50+ fonctions)
- **Authentification** : Supabase Auth
- **Storage** : Supabase Storage

### Intégrations actives
- **Uber Eats API** : Reports API (PAYMENT_DETAILS_REPORT, ORDER_HISTORY_REPORT, etc.)
- **Splash360** : CA caisse par restaurant (API REST)
- **Dishop** : Commandes en ligne Chicken Street (API REST + export ZIP hebdomadaire)
- **Deliveroo** : Import CSV manuel (pas d'API publique)
- **WhatsApp** : Notifications via UltraMsg
- **Mapbox** : Cartographie des restaurants
- **INSEE** : Données de densité de population

---

## Credentials & Configuration

### Uber Eats API (Production)
- Client ID : `wnqg3HLjT98yB25bWtPhB9njQ-ZpKSHX`
- Scopes : `eats.report`, `eats.store`, `eats.store.orders.read`
- Webhook URL : `https://akcicojkrzeirffefdet.supabase.co/functions/v1/uber-report-webhook`
- POS Name : CS Delivery Performance
- 169 stores provisionnés (107 CS + 62 TC)

### Splash360
- Chicken Street : `franchise@chickenstreet.fr` / `lastreetcchic`
- Tasty Crousty : `Soufiane@tastycrousty.io` / `YlT3PkoG`
- Paramètre restaurant : `?restaurant=ID` (pas `restaurantId`)

### Dishop (Chicken Street)
- client_id : `zmedrf_zme2093z_sdfvzer_zevr`
- Base URL : `https://api.dishop.co`
- Company ID : `chickenstreet` (minuscules obligatoires)
- Export : `GET /v1/api/{companyId}/export-weekly-data/accounting-report`

---

## Structure de la base de données

### Tables principales
- `restaurants` — Liste des restaurants avec `uber_store_id`, `chain_id`
- `chains` — Marques (Chicken Street, Tasty Crousty...)
- `orders` — Commandes Uber Eats (4M+ lignes) avec `data_source`
- `order_items` — Détail des articles commandés
- `payouts` — Versements Uber Eats
- `payout_adjustments` — Ajustements (éco-contribution, etc.)
- `deliveroo_orders` — Commandes Deliveroo
- `customer_reviews` — Avis clients Uber Eats
- `splash360_daily_sales` — CA caisse par restaurant par jour
- `dishop_orders` — Commandes Dishop (Click & Collect + livraison propre)
- `dishop_order_items` — Détail produits Dishop
- `backfill_jobs` — Suivi du backfill historique Uber

### Multi-tenant (RBAC)
- `user_chain_access` — Accès utilisateur par chaîne
- `restaurant_visibility_grants` — Visibilité par restaurant
- Isolation stricte par `chain_id` sur toutes les tables

---

## Formule de rentabilité

```
CA HT opérationnel = sales_excl_vat - item_promo_excl_vat - uber_fee_after_promo_excl_vat
Versement total = net_payout + meal_voucher_amount
Rentabilité = Versement total / CA HT opérationnel × 100
```

Éléments exclus volontairement : remboursements, éco-contribution, co-financements Uber (leviers variables).

---

## Pages principales

| Route | Description |
|-------|-------------|
| `/` | Landing page publique |
| `/overview` | Vue réseau consolidée |
| `/analytics/revenue` | Revenus & Ventes avec LFL |
| `/analytics/downtime` | Comparatif disponibilité |
| `/analytics/eco-contribution` | Éco-contribution |
| `/analytics/item-sales` | Ventes par article |
| `/compare/downtime` | Comparatif downtime réseau |
| `/finances` | Finances détaillées |
| `/reviews` | Avis clients |
| `/settings/integrations` | Connexions Uber/Splash/Dishop |
| `/admin` | Administration (super admin) |

---

## Edge Functions importantes

| Fonction | Rôle |
|----------|------|
| `uber-create-report` | Crée un rapport Uber Eats via API |
| `uber-report-webhook` | Reçoit les webhooks Uber + parse CSV |
| `parse-payment-report` | Parse les CSV Uber Eats |
| `uber-backfill-reports` | Backfill historique (cron) |
| `sync-splash360` | Sync CA caisse Splash360 |
| `dishop-sync-week` | Import hebdomadaire Dishop |
| `ai-advisor` | Conseiller IA intégré |
| `generate-weekly-report` | Rapport hebdomadaire WhatsApp |
| `auto-generate-reports` | Cron génération rapports automatique |

---

## Conventions de code

### TypeScript
- Pas de `any` si possible
- Interfaces pour tous les types de données
- Hooks React Query pour tous les appels Supabase

### SQL / Supabase
- Toutes les RPC en `SECURITY DEFINER` avec `SET search_path = public`
- Isolation multi-tenant via `user_has_chain_access(chain_id)`
- TZ Paris dans toutes les agrégations : `AT TIME ZONE 'Europe/Paris'`
- Pas de pagination client-side sur les grosses tables → toujours agréger en SQL

### Composants
- shadcn/ui pour tous les composants de base
- Pas de couleurs hardcodées → utiliser les tokens CSS variables
- Badges `DataSourceBadge` pour indiquer la provenance des données (API vs CSV)

---

## Features en cours / roadmap

### En cours
- Intégration Dishop (export hebdomadaire + mapping shops)
- LFL (Like-For-Like / périmètre constant) sur Analytics Revenue
- Redesign navigation par canal (Uber / Deliveroo / Caisse / Vue réseau)

### Roadmap
- Conseiller IA WhatsApp (Claude API + Twilio)
- Alertes automatiques (note < 3 étoiles, taux erreur > 5%)
- API publique pour partenaires (Rania / Tasty Crousty)
- Onboarding automatique nouveaux restaurants
- Rapports hebdomadaires automatiques WhatsApp

---

## Règles importantes

1. **Isolation multi-tenant** — jamais de données cross-chaîne sans vérification `chain_id`
2. **TZ Paris** — toutes les dates agrégées en heure de Paris
3. **SQL > JS** — agréger côté Postgres, pas côté navigateur
4. **Pas de pagination client** — utiliser des RPC pour les gros volumes
5. **Sentinel UUID** — `'00000000-0000-0000-0000-000000000000'` pour éviter les requêtes sans scope
6. **data_source** — tagger chaque commande avec `uber_api` ou `csv_import`
