
# Distinguer Prelevement et Remboursement Eco-Contribution

## Probleme actuel

Le parser (`parse-payment-report`) utilise `Math.abs()` sur les montants eco-contribution (ligne 523), ce qui fait perdre le signe. Resultat :
- **La Roche-sur-Yon** : les remboursements (+28.02, +29.72...) sont stockes en positif -> OK
- **Melun** : les prelevements (-52.68, -55.78...) sont aussi stockes en **positif** -> FAUX

Dans le tableau, on voit une seule colonne "Eco-contrib." avec un montant positif dans les deux cas, impossible de distinguer remboursement vs prelevement.

## Solution

### 1. Ajouter une colonne `eco_contribution_charge` a la table `payouts`

- `eco_contribution_refund` (existant) : garde uniquement les **remboursements** (montants positifs)
- `eco_contribution_charge` (nouveau) : stocke les **prelevements** (montants negatifs, stockes en valeur absolue positive)

Migration SQL :
```sql
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS eco_contribution_charge NUMERIC DEFAULT 0;
```

### 2. Modifier le parser `parse-payment-report`

Remplacer la logique actuelle (ligne 522-533) qui fait `Math.abs()` par une separation :
- Si `candidateAmount > 0` : c'est un **remboursement** -> accumuler dans `eco_contribution_refund`
- Si `candidateAmount < 0` : c'est un **prelevement** -> accumuler dans `eco_contribution_charge` (stocke en positif)

Mettre a jour la Phase 3 (lignes 840-857) pour ecrire les deux colonnes.

### 3. Mettre a jour la RPC `get_monthly_payouts_detail`

Ajouter `eco_contribution_charge` dans le `RETURNS TABLE` et le `SELECT`.

### 4. Modifier le tableau `ProfitabilityComparisonTable.tsx`

Remplacer la colonne unique "Eco-contrib." par deux colonnes :
- **Eco Remb.** (vert) : remboursements recus d'Uber
- **Eco Prel.** (rouge) : prelevements factures par Uber

Cela permet de suivre si un prelevement a ete compense par un remboursement ulterieur.

Propager dans les agregations (semaine, mois, totaux).

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| Migration SQL | Ajouter colonne `eco_contribution_charge` |
| Migration SQL | Mettre a jour RPC `get_monthly_payouts_detail` |
| `supabase/functions/parse-payment-report/index.ts` | Separer remboursement/prelevement par signe |
| `src/components/analytics/ProfitabilityComparisonTable.tsx` | 2 colonnes distinctes avec couleurs |

## Donnees existantes

Les payouts deja importes devront etre re-calcules. On peut le faire via une requete UPDATE qui relit `payout_adjustments` (qui conserve le signe original) pour recalculer `eco_contribution_refund` et `eco_contribution_charge` correctement.

```sql
-- Recalcul depuis payout_adjustments (qui a le bon signe)
UPDATE payouts p SET
  eco_contribution_refund = COALESCE(pos.total, 0),
  eco_contribution_charge = COALESCE(neg.total, 0)
FROM (
  SELECT restaurant_id, payout_date, SUM(amount) as total
  FROM payout_adjustments WHERE category = 'other_fee' AND amount > 0
  GROUP BY restaurant_id, payout_date
) pos
...
```
