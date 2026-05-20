Oui, on a bien la data côté base : pour Chicken Street en juin 2025, la requête directe remonte 115 050 commandes, 27 291 commandes taxées et 29 201,37€ de frais d’offres TTC. Le backend répond normalement.

Le problème restant ressemble donc à un blocage frontend, pas à une absence de données.

Plan de correction :

1. Corriger le guard de chargement dans `OffersAnalyticsSection`
   - Ne plus afficher un spinner infini si `useOffersAnalytics` est désactivé parce que le scope contient le sentinel.
   - Calculer explicitement un état `hasSentinelScope` / `isRestaurantScopeReady`.
   - N’appeler l’affichage de chargement que quand les restaurants sont réellement en train de charger ou quand la requête active est en cours.

2. Durcir `useOffersAnalytics`
   - Centraliser la constante sentinel.
   - Désactiver aussi la requête `success_scores` quand le scope n’est pas prêt, car elle part aujourd’hui même avec le sentinel et peut contribuer au comportement confus.
   - Ajouter `restaurantIds.length > 0` dans l’activation des requêtes pour éviter les appels non filtrés accidentels.

3. Corriger le chargement de l’onglet `Croisements`
   - `useOfferFeesCorrelation` est déjà protégé contre le sentinel, mais l’onglet peut rester vide si `monthlyStats` arrive après.
   - Garder le comportement activé uniquement quand `restaurantIds` réels + dates + données mensuelles sont présents.

4. Validation
   - Vérifier que l’UI sort du spinner sur `/analytics/offers`.
   - Vérifier que la période visible affiche les frais attendus (ex. juin 2025 Chicken Street ≈ 29 201,37€ TTC).
   - Vérifier qu’aucun appel RPC ne part avec `00000000-0000-0000-0000-000000000000`.