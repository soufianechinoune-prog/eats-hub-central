
# Fix: Graphiques finances qui ne chargent pas — `useFinancesDrilldown` trop lent

## Diagnostic

Le graphique "Rentabilité globale" **fonctionne** (les logs montrent 4 data points, 4.2M€ de ventes). Ce qui bloque, c'est la section **"Analyse des commandes"** (`OrdersAnalysisSection`) en dessous, qui utilise `useFinancesDrilldown`.

Ce hook fait des boucles de pagination sur la table `orders` brute (PAGE_SIZE=1000, while loop) **sans `retry: false`**. Pour 150+ restaurants sur 3-4 mois, ça représente potentiellement des dizaines de milliers de lignes récupérées une par une, avec 3 retries par défaut en cas de timeout.

## Corrections

### 1. `src/hooks/useFinancesDrilldown.ts` — `retry: false` sur toutes les queries
Ajouter `retry: false` aux 4 `useQuery` du hook (lignes ~541, ~560, ~616, ~648) pour éviter les retries de timeout qui multiplient les temps d'attente.

### 2. `src/components/analytics/OrdersAnalysisSection.tsx` — Lazy loading
La section "Analyse des commandes" n'a pas besoin de charger immédiatement. Passer `enabled: false` par défaut et ne l'activer que quand l'utilisateur clique/scroll vers cette section. Cela évite de bloquer l'affichage du graphique de rentabilité pendant que les commandes individuelles chargent.

Concrètement : ajouter un state `isExpanded` (défaut `false`) avec un bouton "Charger l'analyse des commandes". Les queries de `useFinancesDrilldown` ne se lancent que quand `isExpanded = true`.

### 3. `src/components/analytics/FinancesSection.tsx` — `retry: false` sur la query RPC
Ajouter `retry: false` à la query `get_profitability_daily` (ligne ~93) pour cohérence.

## Fichiers modifiés
- `src/hooks/useFinancesDrilldown.ts` — retry: false sur les 4 queries
- `src/components/analytics/OrdersAnalysisSection.tsx` — lazy loading avec bouton d'expansion
- `src/components/analytics/FinancesSection.tsx` — retry: false sur la query RPC

## Résultat attendu
- Le graphique de rentabilité apparaît immédiatement (déjà OK)
- Plus de chargement bloquant en dessous
- L'analyse des commandes se charge uniquement à la demande
