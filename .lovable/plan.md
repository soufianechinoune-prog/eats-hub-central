## Diagnostic

Le backend répond normalement et je ne vois pas de nouveau timeout côté logs. Le blocage visible sur ta capture vient surtout d’un point précis dans le frontend :

- Le graphique **Rentabilité globale** de la page `/analytics/revenue` continue d’utiliser `useFinancesDrilldown`.
- Ce hook va chercher les **commandes brutes paginées** dans `orders`, parfois sur une grande période et sur beaucoup de restaurants.
- Donc même si on a optimisé les RPC principales, ce graphique lance encore une lecture lourde côté navigateur.
- En plus, `Analytics.tsx` charge déjà les données agrégées via `get_profitability_daily`, mais `AnalyticsCharts.tsx` ne les réutilise pas pour ce graphique : il refait son propre chargement lourd.

Conclusion simple : **la data existe, mais le graphique attend une requête trop lourde qui n’a plus lieu d’être.**

## Plan de correction

1. **Brancher le graphique Rentabilité sur les données déjà agrégées**
   - Utiliser `profitabilityData` et `prevProfitabilityData` déjà chargées dans `Analytics.tsx`.
   - Ne plus utiliser `useFinancesDrilldown` pour ce graphique dans la page Revenue.

2. **Convertir ces données au format attendu par le graphique**
   - Transformer les lignes `get_profitability_daily` en données journalières compatibles avec `ProfitabilityComparisonChart`.
   - Garder les mêmes champs : ventes, versement net, titres resto, promos, nombre de commandes.

3. **Préserver les calculs actuels**
   - Ne pas changer les formules de rentabilité.
   - Ne pas changer les montants, commissions, promos, remboursements ou panier moyen.
   - On change seulement la source technique : données agrégées serveur au lieu de commandes brutes côté navigateur.

4. **Garder le chargement précédent pour les sections détaillées seulement**
   - `useFinancesDrilldown` restera utilisé pour les tableaux/drilldowns quand l’utilisateur ouvre une analyse détaillée.
   - Mais le graphique principal ne doit plus dépendre de cette requête lourde.

5. **Corriger l’état de chargement**
   - Le spinner de `Rentabilité globale` devra dépendre des queries agrégées déjà chargées.
   - Si la requête retourne vide, le composant ne doit pas rester bloqué indéfiniment.

6. **Validation**
   - Vérifier que le graphique Rentabilité s’affiche sur `/analytics/revenue`.
   - Vérifier qu’il ne déclenche plus les requêtes lourdes `finances-drilldown-orders` au chargement initial.
   - Vérifier que les chiffres restent cohérents avec les données déjà calculées par `get_profitability_daily`.

## Impact sur la data

Aucun changement de data ni de formule. On remplace simplement :

```text
Avant : navigateur lit beaucoup de commandes brutes puis agrège
Après : backend renvoie déjà les données agrégées, le graphique les affiche
```

C’est exactement le même objectif fonctionnel, mais avec beaucoup moins de données à charger côté page.