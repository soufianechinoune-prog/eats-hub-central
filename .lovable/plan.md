
Objectif: isoler strictement chaque marque pour qu’en sélectionnant TASTY CROUSTY, aucune donnée Chicken Street ne remonte, sans modifier les données existantes de Chicken Street.

1. Corriger la source principale de fuite
- `src/pages/Analytics.tsx`
- La query `restaurants_with_commission` charge encore tous les restaurants sans filtre de marque.
- Ajouter `selectedChainId` au `queryKey` et filtrer `restaurants` par `chain_id`.
- Cela impactera toute la logique “Tous les restaurants”, restaurants épinglés, filtres, affichages et calculs de l’analytics principal.

2. Corriger la page Avis
- `src/pages/Reviews.tsx`
- La query `restaurants-for-reviews` charge encore tous les restaurants.
- La filtrer par `selectedChainId` pour que la liste utilisée par les onglets Avis / Plats soit limitée à la marque active.
- Conserver le fonctionnement actuel des périodes et des filtres existants.

3. Corriger les actions/contextual events qui fuient entre marques
- `src/hooks/useRestaurantActions.ts`
- Aujourd’hui, quand aucun restaurant n’est explicitement sélectionné, le hook peut remonter des actions globales d’une autre marque.
- Faire dépendre le hook de la marque active via `selectedChainId`, récupérer seulement les actions liées aux restaurants de cette marque, et mettre à jour le `queryKey`.
- `src/components/reviews/ReviewsOverview.tsx`
- La query des actions pour le graphe Avis doit suivre la même logique de marque, pas seulement `selectedRestaurants`.

4. Corriger les pages qui utilisent encore tous les restaurants
- `src/components/analytics/OperationsAnalytics.tsx`
  - la query `restaurants_for_ops` doit être filtrée par `selectedChainId`.
- `src/pages/MarketingAnalytics.tsx`
  - la query restaurants locale doit être filtrée par marque.
- `src/hooks/useMarketingCampaigns.ts`
  - si aucun `restaurantIds` n’est fourni, le hook ne doit pas retourner des campagnes d’autres marques ; il faut le brancher sur la marque active.
- `src/pages/Exports.tsx`
  - filtrer la liste des restaurants exportables par marque active.
- `src/pages/UberStoreMapping.tsx`
  - filtrer les restaurants mappables par marque active.

5. Corriger la création/mapping de nouveaux restaurants dans le bon contexte
- `src/components/reports/UnknownStoreMapping.tsx`
- Aujourd’hui, la création automatique prend la première chaîne trouvée en base, ce qui recrée un lien involontaire avec Chicken Street.
- Utiliser la marque active du contexte pour toute création automatique depuis l’import.
- Si aucune marque n’est active, garder un fallback explicite, mais ne jamais réutiliser silencieusement la première chaîne.

6. Vérification de cohérence
- Vérifier que les écrans déjà corrigés restent cohérents:
  - `Overview.tsx`
  - `ReportImport.tsx`
  - `Restaurants.tsx`
  - `useChainRestaurants.ts`
- S’assurer que tous les `queryKey` incluent bien `selectedChainId` dès qu’une query dépend des restaurants visibles.

Résultat attendu
- En sélectionnant TASTY CROUSTY:
  - dashboard vide si aucun resto/data TASTY
  - imports limités à TASTY
  - avis uniquement TASTY
  - actions/événements uniquement TASTY
  - marketing / exports / mapping uniquement TASTY
- Chicken Street reste intact, sans suppression ni altération de données.

Détails techniques
```text
Cause racine:
selectedChainId existe bien dans le contexte global,
mais plusieurs queries continuent à lire la table restaurants
ou restaurant_actions sans filtre chain_id.

Principe du correctif:
1. filtrer la base restaurant par selectedChainId
2. dériver tous les fetchs de données depuis cette base filtrée
3. empêcher toute création auto de restaurant sur la mauvaise chaîne
```
