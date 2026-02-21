

## Creation de l'index covering sur order_items

### Ce qui sera fait

Ajout d'un index covering sur la table `order_items` pour accelerer les jointures avec `orders`. Cet index permet de resoudre les requetes analytiques directement depuis l'index sans acceder a la table, ce qui reduit considerablement la charge.

### Details techniques

Une migration SQL sera executee :

```sql
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_covering
  ON public.order_items(order_id)
  INCLUDE (item_id, item_title, category, quantity, 
           sales_incl_vat, refund_incl_vat, unit_price);
```

Cela n'impacte aucun code existant -- c'est une optimisation transparente cote base de donnees.

### Impact attendu

- Jointures `orders` / `order_items` beaucoup plus rapides
- Moins de pression sur la base pendant les imports
- Les pages analytiques (ventes par article, profitabilite) chargeront plus vite

