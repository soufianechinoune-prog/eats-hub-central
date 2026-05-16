Oui, j’ai compris le problème et pourquoi il persiste.

Le graphique “Rentabilité globale” bascule encore en mode “période courte” parce qu’il décide sa granularité avec `dateRange.end`. Comme la donnée 2026 s’arrête en mai, l’intervalle peut rester court et le composant génère seulement les points visibles jusqu’à mai. Le graphique “Évolution du Panier Moyen”, lui, s’appuie sur une série mensuelle de 12 mois, puis masque uniquement la courbe 2026 après le dernier mois importé.

Plan de correction :

1. Modifier uniquement `src/components/compare/ProfitabilityComparisonChart.tsx`.
2. En mode `yearOverYear`, forcer la vue mensuelle complète Janvier → Décembre, même si `dateRange.end` est en mai.
3. Garder la logique actuelle de cutoff :
   - 2026 reste visible jusqu’au dernier mois avec données réelles,
   - juin → décembre deviennent `null` pour la courbe 2026,
   - la courbe 2025 reste visible de janvier à décembre.
4. Conserver le calcul KPI/comparatif sur la fenêtre comparable seulement, donc janvier → mai dans ton cas.
5. Vérifier que l’axe X affiche bien les 12 mois comme le graphique du panier moyen.