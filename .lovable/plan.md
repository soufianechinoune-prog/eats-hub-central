# Rapport hebdomadaire Uber — Tasty Crousty

Envoi automatique tous les **jeudis à 8h** d'un email contenant **1 XLSX + 1 CSV** avec la data Uber Eats de la semaine précédente (lundi → dimanche, TZ Paris) du réseau Tasty Crousty.

## Ce que reçoit ton ami

**Un email** (destinataire configurable côté admin) avec 2 pièces jointes :

### 1. Fichier XLSX — 4 onglets

| Onglet | Contenu |
|---|---|
| **Résumé semaine** | 1 ligne : totaux réseau TC |
| **Détail par jour** | 7 lignes (lundi → dimanche) |
| **Détail par restaurant** | 1 ligne par resto TC actif |
| **Jour × Restaurant** | 7 × N lignes (le plus fin) |

### 2. Fichier CSV
Un seul CSV « Jour × Restaurant » (le plus fin), ré-importable dans un outil BI.

## Colonnes fournies (identiques dans les 4 onglets, adaptées à la granularité)

- Période / Date / Restaurant (selon onglet)
- **CA brut TTC**
- **CA brut HT**
- **CA net TTC** (après commissions & frais)
- **CA net HT**
- **Commission Uber** (HT)
- **Frais marketing / cofinancement**
- **Frais de service**
- **Nombre de commandes**
- **Versement Uber (payout)**

Source : table `orders` agrégée en TZ Paris + table `payouts` pour le versement réel.

## Livraison

- Cron `pg_cron` déclenche l'edge function chaque **jeudi 08:00 Europe/Paris**
- Edge function `send-tc-weekly-report` :
  1. calcule la semaine ISO précédente (lun→dim)
  2. agrège les données via RPC SQL (SECURITY DEFINER, scopée `chain_id` Tasty Crousty)
  3. génère XLSX (SheetJS) + CSV en mémoire
  4. envoie via Lovable Emails à la liste de destinataires
- Un rerun manuel possible depuis une petite page admin (`/admin/tc-weekly-report`) pour renvoyer une semaine précise.

## Sécurité

- **Aucune clé API Uber n'est partagée**
- Données scopées strictement `chain_id = Tasty Crousty` côté SQL
- Destinataires stockés en DB (table `tc_report_recipients`), modifiables uniquement par super admin
- Log de chaque envoi (date, destinataires, hash du fichier) dans `tc_report_runs`
- Idempotence : pas de double envoi la même semaine

## Détails techniques

**Nouveau côté DB :**
- Table `tc_report_recipients` (id, email, active, created_at) — RLS super_admin
- Table `tc_report_runs` (id, week_start, week_end, sent_at, recipients, status, error) — RLS super_admin
- RPC `get_tc_weekly_report(week_start, week_end)` → renvoie 4 datasets (résumé, par jour, par resto, jour×resto) en SECURITY DEFINER, filtré `chain_id` TC
- Cron `pg_cron` : `0 8 * * 4` (jeudi 8h Paris → 6h UTC en hiver, 7h en été ; on schedule à 6h UTC + logique de garde dans la function)

**Nouveau côté code :**
- Edge function `send-tc-weekly-report` (Deno) — génération XLSX via `npm:xlsx`, envoi email via `send-transactional-email`
- Template email `tc-weekly-report` dans `_shared/transactional-email-templates/`
- Page admin `/admin/tc-weekly-report` : liste destinataires (add/remove), historique des envois, bouton « renvoyer une semaine »

**Prérequis :**
- Lovable Emails / domaine email déjà configuré (à vérifier au démarrage — sinon dialog setup)

## Ce que ça ne fait PAS (volontairement)

- Pas d'accès à l'API Uber Eats pour ton ami
- Pas de data item-level (Uber ne l'expose pas fiablement, cf. mémoire projet)
- Pas de Deliveroo / caisse (uniquement Uber comme demandé)
- Pas de vraie API REST (email suffit pour l'usage décrit)
