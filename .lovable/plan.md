

## Backfill des frais d'offre depuis extra_columns

### Contexte
Les 2.8M de commandes importées contiennent déjà les frais d'utilisation de l'offre dans le champ JSONB `extra_columns`. Il suffit de les extraire vers les nouvelles colonnes dédiées.

### Migration SQL unique

```sql
UPDATE orders
SET 
  offer_usage_fee = (extra_columns->>'Frais d''utilisation de l''offre')::numeric,
  vat_offer_usage_fee = (extra_columns->>'TVA sur les frais d''utilisation de l''offre')::numeric
WHERE extra_columns IS NOT NULL
  AND extra_columns ? 'Frais d''utilisation de l''offre'
  AND (offer_usage_fee = 0 OR offer_usage_fee IS NULL);
```

### Résultat attendu
- ~350 622 commandes mises à jour avec le bon montant de frais
- Le dashboard "Offres & Frais" affichera immédiatement les données correctes sans aucune ré-importation
- Les futurs imports utiliseront directement le mapping ajouté au parser

### Aucun changement de code nécessaire
La RPC `get_offers_analytics` et le hook `useOffersAnalytics` lisent déjà les colonnes `offer_usage_fee` / `vat_offer_usage_fee`.

