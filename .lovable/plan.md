## Diagnostic

La lenteur vient principalement des requêtes backend de `/analytics/finances`, pas du rendu React :

- `get_orders_finance_summary` prend jusqu'à ~43-45s et peut finir en timeout.
- `get_profitability_monthly` prend ~29-43s.
- `get_profitability_daily` est encore appelé en doublon depuis `FinancesSection` et prend ~43s.
- `get_orders_finance_yearly_detail` est lancé 3 années en parallèle, paginé, et timeout systématiquement quand le périmètre contient beaucoup de restaurants.
- La section `Analyse par Commandes` est déjà visuellement lazy, mais les données financières lourdes sont quand même déclenchées dès l'arrivée sur la page.
- Il y a aussi un appel avec le sentinel UUID `00000000-0000-0000-0000-000000000000`, ce qui confirme qu'une partie des requêtes part avant résolution complète du périmètre.

## Objectif

Faire apparaître rapidement la page Finances avec les graphiques et KPIs essentiels, puis charger les détails uniquement quand l'utilisateur les demande.

## Plan technique

### 1. Bloquer tous les appels tant que le périmètre restaurants n'est pas réellement prêt

- Renforcer `isRestaurantScopeReady` pour refuser :
  - tableau vide,
  - sentinel UUID,
  - périmètre non résolu.
- Appliquer cette garde aux requêtes actuellement insuffisamment protégées :
  - `advertisingData`,
  - `dailyPayoutsData`,
  - `deliverooPayoutsData`,
  - `profitabilityData`,
  - `prevProfitabilityData`.

Effet attendu : suppression des requêtes inutiles/erronées qui scannent ou timeoutent avant que la chaîne soit résolue.

### 2. Supprimer le doublon `get_profitability_daily` dans `FinancesSection`

Actuellement :

- `Analytics.tsx` calcule déjà `profitabilityData` / `prevProfitabilityData`.
- `FinancesSection.tsx` relance en plus `get_profitability_daily` pour alimenter le graphique.

Changement :

- Faire passer `profitabilityData` et `prevProfitabilityData` à `FinancesSection`.
- Mapper ces données directement pour `ProfitabilityComparisonChart`.
- Ne plus appeler `get_profitability_daily` depuis `FinancesSection`.

Effet attendu : une requête lourde en moins, souvent ~40s économisées.

### 3. Remplacer le détail annuel 3 ans au chargement par un chargement à la demande

Aujourd'hui, en vue annuelle Finances, l'app lance :

```text
get_orders_finance_yearly_detail(selectedYear)
get_orders_finance_yearly_detail(selectedYear - 1)
get_orders_finance_yearly_detail(selectedYear - 2)
```

dès l'ouverture de la page.

Changement :

- Ne plus charger `dailyPayoutsData` automatiquement pour l'année complète.
- Garder le chargement automatique uniquement quand un mois est sélectionné (`drillDownMonth`).
- Pour l'année complète, afficher le graphique/synthèse avec les RPC agrégées mensuelles.
- Dans `Analyse par Commandes`, conserver le bouton `Charger l'analyse des commandes`; déclencher les détails uniquement après clic/expansion.

Effet attendu : suppression des timeouts `get_orders_finance_yearly_detail` au chargement initial.

### 4. Créer une RPC agrégée unique pour la finance annuelle si nécessaire

Si la table de comparaison mensuelle a encore besoin de champs détaillés non couverts par `get_orders_finance_summary`, créer/remplacer une RPC agrégée mensuelle unique qui renvoie uniquement 12 mois × restaurants, pas le détail journalier.

Elle devra renvoyer au minimum :

- CA HT/TTC selon les colonnes nécessaires,
- promos HT/TTC,
- frais Uber HT/TTC,
- `net_payout`,
- `meal_voucher_amount`,
- `order_count`,
- marketing/ads si nécessaire.

Note : cette étape sera aussi l'endroit naturel pour aligner la formule de rentabilité que tu as définie :

```text
Rentabilité = (net_payout + meal_voucher_amount)
              / (sales_excl_vat - item_promo_excl_vat - uber_fee_after_promo_excl_vat)
```

Mais je ne mélange pas encore la refonte formule/LFL tant que l'objectif immédiat est le temps de chargement.

### 5. Optimiser les RPC existantes

Pour `get_orders_finance_summary` et `get_profitability_monthly` :

- garder `SECURITY DEFINER`,
- résoudre les restaurants autorisés une seule fois,
- joindre via `unnest(v_ids)` + `orders.restaurant_id`,
- filtrer sur `order_datetime`,
- éviter les chemins `p_restaurant_ids IS NULL` sur gros scans,
- conserver les dates selon le standard déjà défini pour cette page.

### 6. Vérification après implémentation

Je validerai avec les signaux suivants :

- réseau navigateur sur `/analytics/finances`,
- plus aucun appel initial à `get_orders_finance_yearly_detail` en vue annuelle,
- plus aucun appel avec sentinel UUID,
- disparition du doublon `get_profitability_daily`,
- chargement initial ramené à quelques secondes au lieu de 30-45s+,
- la section `Analyse par Commandes` reste chargée à la demande.

## Fichiers probablement concernés

- `src/pages/Analytics.tsx`
- `src/components/analytics/AnalyticsCharts.tsx`
- `src/components/analytics/FinancesSection.tsx`
- éventuellement une migration backend pour optimiser/remplacer les RPC financières agrégées

## Point important

Avant d'appliquer une migration SQL, je te montrerai le SQL exact comme demandé précédemment.