

# Afficher les commandes Deliveroo dans l'onglet "Par Commande"

## Probleme

L'onglet "Par Commande" ne cherche que dans la table `orders` (Uber Eats). Quand tu es sur l'onglet Deliveroo et que tu cherches la commande 50554882242, elle n'apparait pas car le code ne consulte jamais la table `deliveroo_orders`.

La commande existe bien en base (id: `b823fb40`, restaurant Chicken Street - Argenteuil, 19 janvier, 8,10 EUR).

## Cause technique

1. `FinancesSection.tsx` passe `platform` au `ProfitabilityComparisonTable` mais **pas** au `OrdersAnalysisSection`
2. `useFinancesDrilldown.ts` : le parametre `platform` a un default `"uber_eats"`, donc le bloc "order" (lignes 319-466) ne query que la table `orders`
3. Les onglets "daily" et "hourly" supportent deja Deliveroo (via `fetchDeliverooOrdersData`), mais le bloc "order" n'a aucune logique Deliveroo

## Modifications

### Fichier 1 : `src/components/analytics/FinancesSection.tsx`

Passer le `platform` selectionne a `OrdersAnalysisSection`.

### Fichier 2 : `src/components/analytics/OrdersAnalysisSection.tsx`

- Ajouter une prop `platform` a l'interface
- La transmettre au hook `useFinancesDrilldown`

### Fichier 3 : `src/hooks/useFinancesDrilldown.ts` (bloc "order", lignes 319-466)

Ajouter une branche Deliveroo dans la query "order" :

```text
Si platform === "deliveroo" :
  - Query deliveroo_orders au lieu de orders
  - Chercher par deliveroo_order_id au lieu de uber_order_id
  - Mapper les colonnes : order_amount → sales, commission_amount → uber_fee, etc.
  - Pas de sous-requete order_items (n'existe pas pour Deliveroo)

Si platform === "global" :
  - Combiner les resultats des deux tables
```

Le mapping des colonnes Deliveroo pour chaque commande individuelle :
- `deliveroo_order_id` → affiche comme ID commande
- `delivery_datetime` → date
- `order_amount` → CA TTC
- `commission_amount` → commission
- `total_payable` → versement net
- Regrouper les lignes du meme `deliveroo_order_id` (Livraison + Contribution marketing + Titre resto) en une seule ligne

### Fichier 4 : `src/components/analytics/OrdersAnalysisSection.tsx` (rendu tableau)

Adapter le rendu pour afficher `deliveroo_order_id` au lieu de `uber_order_id` quand la plateforme est Deliveroo, et masquer le bouton d'expansion (pas de donnees `order_items` pour Deliveroo).

## Resultat attendu

- Sur l'onglet Deliveroo, chercher "50554882242" affiche la commande du 19 janvier
- Les onglets Jour/Heure continuent de fonctionner comme avant
- Sur Global, les commandes des deux plateformes apparaissent

