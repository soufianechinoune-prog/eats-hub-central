Je vais corriger l’Overview pour appliquer exactement la règle simple demandée :

1. **CA**
   - Calculer uniquement la somme de la colonne CSV importée dans `orders.sales_incl_vat`.
   - Pas de retraitement métier supplémentaire.

2. **Versement**
   - Calculer uniquement :
     ```text
     Versement = somme Montant total / Total payout (colonne BK) + somme Titre restaurant / Meal Voucher (colonne AD)
     ```
   - Dans la base, cela correspond à :
     ```text
     SUM(orders.net_payout) + SUM(orders.meal_voucher_amount)
     ```

3. **Suppression du mélange de données**
   - Modifier la fonction `get_network_orders_summary` pour enlever totalement `payout_adjustments` du calcul Overview.
   - Ne plus ajouter `Ajustement marketing`, `payout_adjustments.amount`, ni une seconde somme de titres-restaurant depuis `raw_columns`.

4. **Résultat attendu**
   - L’Overview affichera les colonnes brutes importées depuis le fichier, filtrées par la période sélectionnée.
   - Les écarts liés aux ajustements annexes disparaîtront : le calcul sera une addition simple des colonnes importées.