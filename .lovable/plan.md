

## Problème identifié

La table `restaurant_menu_prices` contient **8 140 lignes**. Le hook `useRestaurantProfitability` fait une seule requête sans pagination (ligne 78-81), ce qui déclenche la **limite par défaut de 1 000 lignes** de la base de données. Résultat : seuls les prix des ~7 premiers restaurants sont récupérés, les autres (dont Argenteuil) affichent "—".

C'est exactement le même bug que celui corrigé précédemment pour l'export "Tarifs réseau" dans `InterRestaurantComparison.tsx`.

## Plan

**1. Paginer la requête des prix dans `useRestaurantProfitability.ts`**

Remplacer l'appel unique à `restaurant_menu_prices` par une boucle paginée (batches de 1 000 lignes avec `.range(from, to)`) identique au pattern déjà utilisé dans `InterRestaurantComparison.tsx`.

```text
Avant:  1 requête → max 1000 lignes → données tronquées
Après:  N requêtes de 1000 → 8140+ lignes → toutes les données
```

**2. Même correction dans `useRestaurantMenuPrices.ts`** (si applicable)

Vérifier si ce hook a le même problème et appliquer la pagination si nécessaire — il alimente le tableau de prix (screenshot 1) qui pourrait aussi être impacté.

**Fichiers impactés :**
- `src/hooks/useRestaurantProfitability.ts` — pagination de la requête prix
- `src/hooks/useRestaurantMenuPrices.ts` — vérification + pagination si nécessaire

