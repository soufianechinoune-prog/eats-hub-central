

## Nouvel onglet "Offres & Frais d'utilisation"

### Contexte des données

Les données sont riches dans la table `orders` :
- **57 566 commandes** avec `marketing_fee_adjustment != 0` (frais 0.89€+)
- **635 935 commandes promo** (`item_promo_incl_vat != 0`)
- **71 753€** de frais d'offre cumulés depuis 2025
- Les frais apparaissent principalement à partir de **mars 2025** (date de mise en place par Uber)
- Certains restaurants sont exonérés (Gold/Platinum) : promo mais 0€ de frais

### Emplacement

Nouveau sous-onglet dans la sidebar Analytics, entre "Finances & Frais" et "Opérations" :
- URL : `/analytics/offers`
- Titre : "Offres & Frais"
- Icône : `Tag` (lucide)

### Contenu de la page (5 sections)

**1. KPI Cards (haut de page)**
- Total frais d'offre (€) sur la période + évolution N-1
- Nb commandes avec frais / Nb commandes promo = % de commandes taxées
- Frais moyen par commande taxée (devrait être ~0.89€, vérifie la cohérence)
- Taux d'utilisation d'offre : % commandes avec promo sur total commandes

**2. Tableau "Analyse par restaurant"**
- Colonnes : Restaurant | Commandes totales | Commandes promo | % promo | Commandes taxées | % taxé/promo | Total frais (€) | Frais/commande
- Tri par total frais décroissant
- Highlight des restaurants non exonérés (ceux où commandes taxées > 0)
- Badge "Exonéré" pour les restaurants avec promo mais 0 frais (Gold/Platinum)

**3. Graphique évolution mensuelle**
- Barres empilées par mois : frais d'offre par restaurant (top 10 + "Autres")
- Ligne overlay : % de commandes promo taxées
- Permet de voir quand la taxe a été introduite et son évolution

**4. Heatmap "Couverture des offres"**
- Axe X : mois, Axe Y : restaurants
- Couleur : % de commandes avec offre active
- Permet de visualiser quels restaurants ont des promos actives et quand

**5. Détection d'anomalies (section bottom)**
- Restaurants avec frais > 0 mais score Success Score Gold/Platinum → alerte "devrait être exonéré"
- Restaurants avec frais moyen > 0.89€ → alerte "surfacturation potentielle"
- Restaurants avec beaucoup de promo mais 0 commandes taxées → confirmation exonération

### Implémentation technique

1. **Nouveau fichier** : `src/components/analytics/OffersAnalyticsSection.tsx`
   - Composant principal avec les 5 sections
   - Requête directe sur `orders` groupée par restaurant_id et mois
   - Jointure côté client avec `success_scores` pour détecter les exonérations

2. **Modifier** `src/pages/Analytics.tsx` :
   - Ajouter `"offers"` au type viewMode
   - Ajouter le rendu conditionnel pour `viewMode === "offers"`

3. **Modifier** `src/components/layout/AppSidebar.tsx` :
   - Ajouter l'entrée "Offres & Frais" dans `analyticsSubItems`

4. **Hook dédié** : `src/hooks/useOffersAnalytics.ts`
   - Fetch les données agrégées par restaurant/mois depuis `orders`
   - Calcule les KPIs et les anomalies
   - Utilise les filtres globaux (restaurants, période, plateforme) du contexte Analytics

### Pas de migration DB nécessaire
Toutes les données existent déjà dans `orders.marketing_fee_adjustment` et `orders.item_promo_incl_vat`.

