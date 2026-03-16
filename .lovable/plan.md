

## Corriger l'écart de rentabilité Deliveroo entre Overview et Finances

### Cause racine
La RPC `get_network_deliveroo_summary` filtre `total_payable` uniquement sur les lignes `Livraison/À emporter/Nouvelle livraison`, ignorant les remboursements, contributions marketing, et autres déductions. La vue Finances utilise `get_deliveroo_payouts_detail` qui somme `total_payable` sur toutes les lignes → résultat plus bas mais correct.

### Correction

**Migration SQL** — Mettre à jour `get_network_deliveroo_summary` pour :
- Garder `total_revenue` = `SUM(order_amount)` filtré sur `Livraison/À emporter/Nouvelle livraison` (inchangé, c'est le CA)
- Changer `total_payable` = `SUM(total_payable)` sur **toutes les lignes** (sans filtre `history_type`), en excluant seulement les types "facture précédente" comme le fait déjà la RPC Finance

```sql
-- Avant (faux) :
SUM(d.total_payable) avec WHERE history_type IN ('Livraison','À emporter','Nouvelle livraison')

-- Après (correct) :
-- revenue = SUM(order_amount) WHERE history_type IN (...)  -- inchangé
-- total_payable = SUM(total_payable) sur toutes les lignes du restaurant/période
```

### Fichiers impactés
- **1 migration SQL** : `ALTER FUNCTION get_network_deliveroo_summary` pour séparer le calcul revenue vs payable
- Aucun changement côté client (les hooks `useOverviewData` et `useNetworkStats` consomment déjà `total_payable` tel quel)

### Résultat
Les deux vues afficheront le même taux de rentabilité (~59%) car elles utiliseront la même base de calcul : versement net réel / CA brut.

