
# Afficher les donnees Deliveroo dans Finances & Frais

## Probleme

Quand on selectionne l'onglet "Deliveroo" sur la page Finances & Frais, les donnees affichees proviennent toujours des tables Uber Eats (`orders`, `payouts`). Il faut que chaque composant de la page lise la table `deliveroo_orders` lorsque la plateforme Deliveroo est selectionnee.

## Donnees disponibles dans `deliveroo_orders`

Pour les lignes "Livraison" (17 156 enregistrements) :
- **CA** : `order_amount`
- **Commission** : `commission_amount` (avec `commission_rate`)
- **TVA** : `vat_amount`
- **Versement** : `total_payable`
- **Ajustements** : `adjustment_amount`

Autres types exploitables :
- Titres restaurant (Edenred, Swile, Sodexo, Up, Bimpli) : equivalents de `meal_voucher_amount`
- Remboursements clients : equivalent de `refund_incl_vat`
- Promos/marketing : "Partner funding", "Contribution marketing", "Bon de reduction"
- Publicite : "Publicites Marketer"
- Eco-contribution : une seule ligne

## Plan de modifications

### 1. Hook `useFinancesDrilldown.ts` - Ajouter le support plateforme

Ajouter un parametre `platform?: "uber_eats" | "deliveroo" | "global"` au hook.

Quand `platform === "deliveroo"` :
- Requeter `deliveroo_orders` au lieu de `orders`
- Filtrer sur `delivery_datetime` au lieu de `order_datetime`
- Mapper les colonnes Deliveroo vers l'interface existante :
  - `order_amount` vers `sales_incl_vat`
  - `commission_amount` vers `uber_fee_incl_vat` (renomme conceptuellement en "commission")
  - `total_payable` vers `net_payout`
  - Agreger les lignes "titre restaurant" pour `meal_voucher_amount`
  - Agreger les "Remboursement client" pour `refund_incl_vat`
  - Agreger les promos pour `promo_incl_vat`

Quand `platform === "global"` : fusionner les resultats des deux sources.

### 2. `FinancesSection.tsx` - Propager la plateforme

Transmettre `selectedPlatform` au hook `useFinancesDrilldown` utilise dans ce composant pour le graphique de rentabilite.

### 3. `ProfitabilityComparisonTable` - Version Deliveroo

Pour la plateforme Deliveroo, creer une source de donnees alternative :
- Au lieu d'utiliser `dailyPayoutsData` (RPC Uber), agreger les donnees depuis `deliveroo_orders` groupees par semaine/mois
- Adapter les colonnes du tableau : remplacer "Versement Uber" par "Versement Deliveroo", masquer les colonnes non pertinentes (Eco Remb., Eco Prel., Pub) sauf si les donnees existent
- Les colonnes affichees seront : Restaurant, CA TTC, Rentabilite, Commission, Promos, Remb., Titre Resto, Versement Total

### 4. `Analytics.tsx` - Conditionner les requetes par plateforme

Quand `selectedPlatform === "deliveroo"` :
- Ne pas appeler le RPC `get_monthly_payouts_detail` (specifique Uber)
- A la place, creer une requete sur `deliveroo_orders` avec la meme structure temporelle (mois par mois)
- Passer les resultats mappes au composant `AnalyticsCharts`

### 5. `AnalyticsCharts.tsx` - Routage conditionnel

Dans le rendu de `FinancesSection`, passer les donnees Deliveroo quand la plateforme est selectionnee :
- `dailyPayoutsData` : donnees Deliveroo agregees si platform === "deliveroo"
- `selectedPlatform` : deja transmis (ligne 3342)

## Details techniques

### Mapping des colonnes Deliveroo vers le format Uber

```text
Deliveroo                    -->  Interface existante
------------------------------------------------------
order_amount                 -->  sales_incl_vat
commission_amount            -->  uber_fee_after_promo_incl_vat
total_payable                -->  net_payout
SUM(titre resto types)       -->  meal_voucher_amount
SUM(Remboursement client)    -->  refund_incl_vat
SUM(Partner funding + ...)   -->  item_promo_incl_vat
SUM(Publicites Marketer)     -->  other_payments (ads)
delivery_datetime            -->  order_datetime / payout_date
```

### Requete Deliveroo type (pour remplir le tableau mensuel)

Pour chaque mois, agreger les lignes par `restaurant_id` et `history_type`, puis pivoter pour obtenir la meme structure que les payouts Uber. Le regroupement se fait cote client car il n'y a pas de RPC existante pour Deliveroo.

### Fichiers modifies

1. `src/hooks/useFinancesDrilldown.ts` - Ajouter parametre `platform`, logique de requete conditionnelle
2. `src/components/analytics/FinancesSection.tsx` - Propager `selectedPlatform` au hook
3. `src/components/analytics/ProfitabilityComparisonTable.tsx` - Accepter les donnees Deliveroo (meme interface, colonnes adaptees)
4. `src/pages/Analytics.tsx` - Ajouter requete Deliveroo pour les payouts finances
5. `src/components/analytics/AnalyticsCharts.tsx` - Router les bonnes donnees selon la plateforme

### Colonnes masquees pour Deliveroo

Les colonnes suivantes n'ont pas d'equivalent dans les releves Deliveroo et seront masquees ou affichees a zero :
- Commission brute vs nette (Deliveroo ne fournit qu'un taux unique)
- "Reduction Uber" (specifique Uber)
- Marketing fee adjustment (pas dans les releves)
