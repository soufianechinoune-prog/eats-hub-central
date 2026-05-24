## Cause de l'incohérence

Deux types de données coexistent dans `orders` pour les remboursements Uber :

- `refund_incl_vat < 0` → débit client (la commande #FDC77 à -15,20 €, #14DCE à -11,60 €, etc.)
- `refund_incl_vat > 0` → **crédit reçu d'Uber** (legacy API, sans détail de contestation). C'est le cas de #38186 (+2 €) et #E0EA5 (+11,60 €).
- `refund_contested_incl_vat > 0` → crédit issu d'une **contestation gagnée**, parsé depuis la col 64 du CSV Paiements Uber.

Le funnel actuel (`get_refund_contestation_funnel`) ne compte dans **"Contestées gagnées"** que `refund_contested_incl_vat > 0`. Pour janvier 2026 sur ces 3 restaurants, le CSV Paiements n'a pas encore été backfillé → la colonne est à 0 partout, donc l'étage 2 affiche `0 cmd / 0 €` et le solde net à charge = 100 % des débits (-712 €).

Pourtant les crédits +2 € et +11,60 € visibles dans la table sont bien des recrédits Uber : ils sont juste stockés dans `refund_incl_vat` (positif) au lieu de `refund_contested_incl_vat`. Le RPC `get_uber_payouts_detail` les compte déjà correctement (lignes 56-57 de la migration `20260524155902`), mais le funnel ne le fait pas → c'est l'incohérence.

## Correctif

### 1. RPC `get_refund_contestation_funnel`

Aligner la logique sur `get_uber_payouts_detail` : considérer **tout `refund_incl_vat > 0` comme une contestation gagnée legacy**, en plus de `refund_contested_incl_vat > 0`.

```sql
-- Étage 2 : Contestées gagnées (legacy crédits + nouveaux crédits contestés)
COUNT(*) FILTER (
  WHERE refund_contested_incl_vat > 0 OR refund_incl_vat > 0
) AS contested_won_count,

ROUND(COALESCE(SUM(
  GREATEST(refund_contested_incl_vat, 0)
  + CASE WHEN refund_incl_vat > 0 THEN refund_incl_vat ELSE 0 END
), 0)::numeric, 2) AS contested_won_amount,

-- Étage 3 : Solde net = débits + crédits (legacy & contestés)
ROUND(COALESCE(SUM(
  CASE WHEN refund_incl_vat < 0 THEN refund_incl_vat ELSE 0 END
  + GREATEST(refund_contested_incl_vat, 0)
  + CASE WHEN refund_incl_vat > 0 THEN refund_incl_vat ELSE 0 END
), 0)::numeric, 2) AS net_amount
```

Résultat attendu pour janvier 2026 / 3 restos : Étage 2 ne sera plus à 0, et le solde net `-712 €` baissera du montant total des crédits positifs.

### 2. Table "Détail des commandes" (`RefundOrdersDetailTable.tsx`)

Pour lever toute ambiguïté visuelle, renommer la colonne et signaler les recrédits legacy :

- Renommer **"Remb. client"** → **"Débit / Crédit"** (1 seule colonne, signe explicite).
- Si `refund_incl_vat > 0` ET `refund_contested_incl_vat = 0` ET `dispute_status IS NULL` → badge gris **"Recrédit Uber (legacy)"** dans la colonne "Statut litige" au lieu du tiret.
- Garder la colonne "Recrédité (contestation)" inchangée pour les futures données backfillées.

### 3. Bannière d'avertissement

L'encart orange "Aucune contestation détectée" doit aussi tenir compte des crédits legacy : ne l'afficher que si **étage 2 = 0 ET aucun `refund_incl_vat > 0` sur la période**.

## Fichiers touchés

- `supabase/migrations/<nouvelle>.sql` — recréer `get_refund_contestation_funnel`
- `src/components/analytics/RefundOrdersDetailTable.tsx` — header colonne + badge legacy
- `src/components/analytics/RefundsSection.tsx` — condition d'affichage de la bannière

Aucun changement sur le parser, le backfill ou le RPC détail.
