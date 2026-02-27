

# Ajouter les types Deliveroo 2026 (annulations) dans l'agrégation client

## Contexte

Le parser backend accepte déjà tous les types sans filtrage. Les 4 types suivants doivent être catégorisés dans l'agrégation client pour des KPIs corrects :

- **"Montant commande annulée"** → CA annulé, à traiter comme un remboursement (négatif)
- **"Commission Deliveroo sur la commande annulée"** → commission remboursée sur annulation
- **"Frais d'annulation de commande"** → frais facturé au restaurant (débit)
- **"Eco-contribution – article L.541-10 du Code de l'environnement"** → éco-taxe (débit)

Sans catégorisation explicite, ces types tombent dans le `else` générique avec `Math.abs()`, ce qui peut fausser les montants.

## Changements

### 1. `src/pages/Analytics.tsx` (2 occurrences d'agrégation)

- Créer `CANCELLATION_ORDER_TYPES = ["Montant commande annulée"]` → traiter comme refund (ajout à `refund_incl_vat` + `net_payout`)
- Créer `CANCELLATION_FEE_TYPES = ["Frais d'annulation de commande"]` → débit, ajout à `other_payments_incl_vat` + `net_payout`
- Ajouter `"Commission Deliveroo sur la commande annulée"` dans `EXTRA_COMMISSION_TYPES`
- Ajouter `"Eco-contribution – article L.541-10 du Code de l'environnement"` dans un nouveau `ECO_CONTRIBUTION_TYPES` → débit, ajout à `other_payments_incl_vat` + `net_payout`

### 2. `src/hooks/useFinancesDrilldown.ts`

- Mêmes ajouts dans les constantes et la logique d'agrégation

### 3. Note sur les 7 fichiers en échec

Les logs montrent 0 appels au parser pour ces fichiers → l'échec est probablement côté lecture navigateur (avant l'envoi). Le `catch {}` silencieux (ligne 183 de DeliverooImportTab.tsx) masque l'erreur native. Un correctif séparé (exposer l'erreur native) est recommandé en complément.

## Fichiers modifiés
- `src/pages/Analytics.tsx` — 2 blocs d'agrégation
- `src/hooks/useFinancesDrilldown.ts` — 2 blocs d'agrégation

