## Objectif

Générer chaque lundi matin un rapport hebdomadaire Uber Eats (semaine précédente, lundi→dimanche, TZ Paris) avec 4 niveaux de granularité, disponible en téléchargement dans l'app **et** envoyé par email au format XLSX + PDF.

## Domaine d'envoi

Utilisation du domaine déjà rattaché au projet : **cs-delivery-performance.com**
- Expéditeur : `Rapports CS Delivery <reports@cs-delivery-performance.com>`
- Aucune manip DNS supplémentaire (délégation NS déjà en place via le custom domain)

## Contenu du rapport

Un fichier XLSX avec 4 onglets + un PDF récapitulatif :

1. **Onglet "Réseau"** — Totaux semaine (1 ligne)
2. **Onglet "Par jour"** — 7 lignes (lun→dim)
3. **Onglet "Par restaurant"** — 1 ligne par restaurant actif
4. **Onglet "Jour × Restaurant"** — matrice détaillée

**Colonnes communes** (par ligne d'agrégat) :
- CA brut TTC / CA brut HT
- CA net TTC / CA net HT (après commissions)
- Commission Uber (€)
- Frais marketing (€)
- Frais de service (€)
- Nombre de commandes
- Versement Uber (payout net)

## Architecture

### 1. Base de données
- **Table `weekly_reports`** : historique des rapports générés
  - `id, chain_id, week_start, week_end, xlsx_path, pdf_path, sent_to[], sent_at, status, created_at`
  - RLS scoping par `chain_id` via `user_has_chain_access`
- **Table `weekly_report_recipients`** : destinataires configurables par chaîne
  - `id, chain_id, email, active, created_at`
- **Bucket Storage `weekly-reports`** (privé, signed URLs)

### 2. RPC d'agrégation
Nouvelle fonction `get_weekly_report_data(p_chain_id, p_week_start, p_week_end)` :
- SECURITY DEFINER, TZ Europe/Paris
- Source unique : table `orders` (cohérent avec Overview/Finances)
- Retourne un JSON avec les 4 niveaux d'agrégation en une seule requête

### 3. Edge Functions
- **`generate-weekly-uber-report`** : construit XLSX (via `exceljs` npm) + PDF (via `pdf-lib`), upload vers Storage, insère dans `weekly_reports`
- **`send-weekly-uber-report`** : lit `weekly_report_recipients`, envoie via le pipeline transactionnel (template dédié avec liens signés vers les fichiers)
- **Cron pg_cron** : lundi 07h00 Paris → invoque generate puis send pour chaque chaîne active

### 4. Email transactionnel
- Setup email infra (queues, cron, tables) sur le domaine `cs-delivery-performance.com`
- Template `weekly-uber-report` (React Email) :
  - Sujet : "Rapport hebdo Uber Eats — semaine du {date}"
  - Corps : résumé KPI (CA, commandes, payout) + boutons de téléchargement XLSX/PDF (signed URLs 7j)

### 5. UI
- Nouvelle page **`/reports/weekly`** :
  - Liste historique des rapports (dernier en tête)
  - Boutons télécharger XLSX / PDF
  - Bouton "Générer maintenant" (admin)
  - Section "Destinataires email" avec add/remove
- Entrée menu dans la sidebar sous "Rapports"

## Ordre d'exécution

1. Setup infrastructure email sur `cs-delivery-performance.com`
2. Migration : tables + bucket + RLS + grants
3. RPC `get_weekly_report_data`
4. Edge Function `generate-weekly-uber-report` + test manuel
5. Template email + Edge Function `send-weekly-uber-report`
6. Page UI `/reports/weekly` + gestion destinataires
7. Cron pg_cron lundi 07h00

## Détails techniques

- **Périmètre semaine** : lundi 00:00 → dimanche 23:59 Europe/Paris, calculé côté SQL (`date_trunc('week', now() AT TIME ZONE 'Europe/Paris')`)
- **Restaurants** : uniquement les actifs de la chaîne (`is_active = true`)
- **XLSX** : mise en forme pro (headers gras, totaux en gras, format €, freeze panes)
- **PDF** : 1 page A4 paysage, KPI cards + top/flop restaurants
- **Idempotence** : clé `chain_id + week_start` unique sur `weekly_reports` (upsert)
- **Multi-chaîne** : le cron itère sur chaque `chain_id` avec au moins 1 destinataire actif

## Hors scope (peut venir plus tard)

- Deliveroo / Splash / Dishop (v2)
- Comparaison N-1
- Personnalisation des colonnes par destinataire