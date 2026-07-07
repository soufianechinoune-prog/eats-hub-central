## Objectif

Remplacer la livraison email (bloquée par DNS Hostinger) par un envoi WhatsApp automatisé chaque jeudi 8h Paris. Le message contient le résumé chiffré + un lien sécurisé pour télécharger les fichiers XLSX + CSV complets.

Aucune donnée sensible en clair (pas de payout individuel resto dans le message texte — juste des agrégats réseau). Le détail est dans les fichiers téléchargeables via lien signé.

---

## Contenu du message WhatsApp

Exemple généré chaque jeudi 8h :

```
📊 Rapport Tasty Crousty — Semaine 27
Du 30/06/2026 au 06/07/2026

💶 CA brut : 145 230 € TTC (121 025 € HT)
💰 CA net après commissions : 108 921 € HT
🧾 Frais Uber : 12 104 € (commission, marketing, service)
📦 Commandes : 4 287
🏦 Versement Uber : 106 340 €

📥 Détail complet (XLSX + CSV) :
https://cs-delivery-performance.com/r/wr/ab12cd34ef56
Lien valable 30 jours.
```

---

## Architecture technique

### 1. Table `weekly_report_runs` (traçabilité + tokens)

```sql
CREATE TABLE public.weekly_report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES public.chains(id),
  period_start date NOT NULL,     -- lundi
  period_end date NOT NULL,       -- dimanche
  aggregates jsonb NOT NULL,      -- ca_brut_ttc, ca_brut_ht, ca_net_ht, frais_uber, nb_orders, payout
  xlsx_path text NOT NULL,        -- storage path
  csv_path text NOT NULL,
  download_token text NOT NULL UNIQUE,  -- token public court (12 chars)
  token_expires_at timestamptz NOT NULL,
  sent_via_whatsapp boolean DEFAULT false,
  whatsapp_message_id text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(chain_id, period_start, period_end)
);
```

+ table `weekly_report_recipients (chain_id, phone, name, active)` pour lister les numéros à notifier (multi-destinataires possible).

### 2. Bucket Storage `weekly-reports` (privé)

Fichiers stockés sous `{chain_id}/{period_start}/{token}.xlsx` et `.csv`. Accès uniquement via URL signée générée par l'edge fn de download.

### 3. Edge Function `generate-weekly-tc-report` (nouvelle)
- Cron `pg_cron` jeudi 8h Paris.
- Pour chaque `chain_id` configuré :
  - Agrège via RPC `get_weekly_uber_aggregates(chain_id, period_start, period_end)` :
    - CA brut TTC/HT
    - CA net HT après commissions (sales_excl_vat - item_promo_excl_vat - uber_fee_after_promo_excl_vat)
    - Frais Uber (commission + marketing + service)
    - Nombre de commandes
    - Versement Uber (somme `net_payout` de `payouts`)
  - Génère XLSX (SheetJS) 4 onglets : Résumé / Détail jour / Détail resto / Jour×Resto
  - Génère CSV Jour×Resto
  - Upload dans bucket
  - Crée `weekly_report_runs` avec token aléatoire 12 chars
  - Pour chaque recipient : invoke `send-whatsapp` avec message formaté
  - Log dans `notifications` (centre in-app) pour trace admin

### 4. Edge Function `download-weekly-report` (nouvelle, publique)
- Route : reçoit `?token=xxx&format=xlsx|csv`
- Vérifie token + expiration
- Génère URL signée Storage 5 min
- Redirect 302 vers l'URL signée

### 5. Route front `/r/wr/:token`
- Page publique légère (pas d'auth requise, token = secret)
- Affiche : nom chaîne, semaine, résumé chiffré, 2 boutons "Télécharger XLSX" / "Télécharger CSV"
- Les boutons appellent l'edge fn `download-weekly-report`
- Message si token expiré/invalide

### 6. Page admin `/admin/weekly-reports`
- Liste des runs (période, statut envoi WhatsApp, lien token)
- Gestion des destinataires (add/remove numéro + nom)
- Bouton "Relancer manuellement" pour une semaine donnée
- Bouton "Générer maintenant" pour tester

### 7. Notification in-app
À chaque génération réussie, insertion dans `notifications` (centre créé phase précédente) :
> "Rapport hebdo Tasty Crousty S27 envoyé à 2 destinataires WhatsApp"
Lien : `/admin/weekly-reports`

---

## Sécurité

- Token 12 chars aléatoires (~10^18 combinaisons) + expiration 30 jours + révocable.
- Bucket privé, jamais d'URL directe exposée.
- RPC en `SECURITY DEFINER` avec filtre `chain_id`.
- Pas de PII en clair dans le WhatsApp (juste agrégats).
- Page publique du token n'expose que les données de CE run (pas navigation).
- RLS `weekly_report_runs` et `weekly_report_recipients` : super_admin only.

---

## Fichiers créés/modifiés

**Migration SQL** :
- `weekly_report_runs`, `weekly_report_recipients`, RPC `get_weekly_uber_aggregates`, bucket `weekly-reports`.

**Edge Functions** :
- `supabase/functions/generate-weekly-tc-report/index.ts` (nouveau)
- `supabase/functions/download-weekly-report/index.ts` (nouveau)

**Front** :
- `src/pages/WeeklyReportDownload.tsx` (route publique `/r/wr/:token`)
- `src/pages/AdminWeeklyReports.tsx` (route admin)
- `src/App.tsx` : ajout des 2 routes
- Item de menu dans `AppSidebar` (section Admin) : "Rapports hebdo"

**Cron** :
- `pg_cron` schedule dans la migration : `0 7 * * 4` UTC (8h Paris hiver / on gérera l'été via timezone).

---

## Périmètre livraison en une passe

1. Migration : tables + bucket + RPC + cron.
2. Edge fn de génération + edge fn download.
3. Page publique download + page admin.
4. Test manuel avec ton numéro sur la semaine dernière.

Le premier run auto tombera le prochain jeudi 8h. Tu pourras aussi cliquer "Générer maintenant" pour tester immédiatement.

Question rapide avant que je code : **quel numéro WhatsApp** je pré-remplis dans les destinataires par défaut (le tien 06 99 56 40 00 + celui de ton responsable ?), ou tu ajoutes tout via la page admin après ?
