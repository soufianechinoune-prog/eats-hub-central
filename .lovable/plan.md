
# Correction du mapping pour les remboursements TTC en anglais

## Problème identifié

Le fichier CSV d'Uber Eats utilise un **mix français/anglais** pour les colonnes de remboursements :
- HT en français ✅ → `Ajustements liés à des erreurs de commande (hors TVA)` 
- TVA en français ✅ → `TVA sur les ajustements liés à des erreurs de commande`
- **TTC en anglais** ❌ → `Order Error Adjustments (incl. VAT)`

Le parser attendait `Ajustements liés à des erreurs de commande (TVA incluse)` mais le fichier contient `Order Error Adjustments (incl. VAT)`.

## Solution

Ajouter la variante anglaise dans le mapping `COLUMN_MAPPING`.

## Modification technique

| Fichier | Action |
|---------|--------|
| `supabase/functions/parse-payout-summary/index.ts` | Ajouter le header anglais |

### Code à ajouter

```typescript
// NEW: "Ajustements liés à des erreurs de commande" variants
'Ajustements liés à des erreurs de commande (hors TVA)': 'refund_excl_vat',
'TVA sur les ajustements liés à des erreurs de commande': 'vat_refund',
'Ajustements liés à des erreurs de commande (TVA incluse)': 'refund_incl_vat',
'Ajustements liés à des erreurs de commande (TVA incluses)': 'refund_incl_vat',
// English variant found in mixed-language Uber exports
'Order Error Adjustments (incl. VAT)': 'refund_incl_vat',  // ← AJOUT
```

## Après la correction

1. Redéployer l'Edge Function
2. Ré-importer le fichier CSV du 12 janvier
3. Les remboursements (-84,74€) seront correctement importés
