
Objectif: rendre l’isolation des marques réellement stricte. Quand TASTY CROUSTY est sélectionnée, l’app doit afficher soit ses propres données, soit un état vide — jamais de données Chicken Street. Aucune donnée Chicken Street ne sera modifiée.

### Ce que j’ai confirmé
- En base, **TASTY CROUSTY existe mais a 0 restaurant**.
- Plusieurs écrans interprètent encore “aucun restaurant dans la marque” comme **“pas de filtre”**, donc ils remontent toute la data.
- Le header du haut reste brandé **CS Delivery Performance** avec le logo Chicken Street, ce qui entretient la confusion même quand la marque a changé.

### Correctif à appliquer

#### 1. Uniformiser la logique de scope marque/restaurants
Créer une logique unique dans le front pour distinguer 3 cas :
- **all brands**: pas de filtre
- **marque sélectionnée avec restaurants**: filtre sur les restaurants de cette marque
- **marque sélectionnée sans restaurant**: résultat vide forcé

Je vais appliquer ce principe partout au lieu de laisser `[]` retomber sur “tout afficher”.

#### 2. Corriger les hooks qui fuient quand la liste de restos est vide
Mettre à jour les hooks pour que `restaurantIds = []` signifie **0 résultat**, pas **tous les résultats** :
- `src/hooks/useReviews.ts`
- `src/hooks/useEcoContribution.ts`
- `src/hooks/useItemSalesAnalytics.ts`

C’est aujourd’hui une cause directe de fuite sur TASTY.

#### 3. Corriger les pages encore non isolées
Appliquer le filtre de marque ou un état vide strict sur les pages qui affichent encore Chicken Street :

- `src/pages/SuccessScore.tsx`
  - filtrer `success_scores` via les restaurants de la marque active
- `src/components/analytics/EcoContributionSection.tsx`
  - ne plus appeler l’éco-contribution “globale” quand la marque n’a aucun resto
- `src/pages/Reviews.tsx`
  - garantir que la page Avis reste vide si la marque n’a aucun restaurant
- `src/hooks/useOffersAnalytics.ts`
  - filtrer les `success_scores` utilisés dans les analyses d’offres
- `src/pages/Overview.tsx`
  - filtrer aussi le bloc “success score réseau” par marque
- `src/pages/Exports.tsx`
  - empêcher un export “Tous les restaurants” qui ressortirait encore toute la base
- `src/pages/ItemSales.tsx`
  - transmettre un scope cohérent à l’analyse articles

#### 4. Vérifier les vues déjà partiellement corrigées
Repasser sur les écrans déjà touchés pour éviter toute rechute :
- `src/pages/Analytics.tsx`
- `src/components/analytics/OperationsAnalytics.tsx`
- `src/hooks/useMarketingCampaigns.ts`
- `src/hooks/useRestaurantActions.ts`
- `src/pages/MarketingAnalytics.tsx`
- `src/pages/UberStoreMapping.tsx`
- `src/pages/ReportImport.tsx`
- `src/components/reports/UnknownStoreMapping.tsx`

But: s’assurer que partout, “marque vide” reste bien vide.

#### 5. Corriger l’affichage de la marque active dans le header
Mettre à jour le layout global pour que le bandeau du haut reflète la marque active :
- remplacer le branding statique Chicken Street par :
  - soit la **marque active**
  - soit un libellé neutre en mode “Toutes les marques”
- éviter l’effet de “bandeau blanc / marque invisible”
- garder la sidebar cohérente avec le header

Fichier concerné :
- `src/components/layout/AppLayout.tsx`

### Résultat attendu
Quand tu sélectionnes **TASTY CROUSTY** :
- Avis : vide
- Éco-contribution : vide
- Score de réussite : vide
- Articles / exports / analytics : vides
- aucun restaurant Chicken Street n’apparaît
- le header affiche clairement la marque active

### Détail technique
```text
Cause racine principale:
dans plusieurs hooks, l’absence de restaurant scope est traitée comme
"ne pas filtrer", alors qu’en contexte marque cela doit vouloir dire
"aucune donnée".

Règle à imposer:
- undefined => toutes les marques
- [] => aucun résultat
- [ids...] => filtre strict sur ces restaurants
```
