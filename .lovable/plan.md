Objectif : rendre le graphique “Rentabilité globale” identique au comportement de “Évolution du Panier Moyen”.

Comportement attendu :
- Axe X : janvier → décembre.
- Courbe année en cours, ici 2026 : s’arrête au dernier mois importé, donc mai.
- Courbe année précédente, ici 2025 : continue jusqu’à décembre si les données existent.
- KPI / variation : reste calculé uniquement sur la fenêtre comparable janvier → mai.

Cause actuelle :
- Le composant affiche maintenant bien les 12 mois.
- Mais la donnée N-1 envoyée au graphique de rentabilité est encore chargée seulement sur la même fenêtre que 2026, donc janvier → mai.
- Résultat : la courbe grise 2025 n’a pas de points de juin à décembre, même si la donnée existe.

Plan de correction :
1. Modifier le chargement des données N-1 du graphique de rentabilité dans `src/components/analytics/AnalyticsCharts.tsx`.
2. En mode `yearOverYear`, charger la période N-1 jusqu’à la fin de l’année précédente, par exemple janvier → décembre 2025 quand 2026 est sélectionnée.
3. Garder inchangé le chargement de l’année courante : 2026 reste seulement jusqu’à mai si les données s’arrêtent en mai.
4. Garder inchangée la logique du composant `ProfitabilityComparisonChart.tsx` :
   - la courbe 2026 est coupée après mai,
   - les KPI restent calculés sur janvier → mai,
   - la courbe 2025 peut utiliser tous les mois disponibles jusqu’à décembre.
5. Vérifier que le graphique affiche bien la ligne grise jusqu’à décembre, comme le panier moyen.