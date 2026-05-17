## Pourquoi la caisse Reims n'apparaît pas

Trois causes cumulées :

1. **Vue actuelle = Réseau global** (169 restos = Chicken Street + TASTY). `selectedChainId` vaut `null`, et les hooks `useNetworkCashRevenue` / `useRestaurantCashRevenue` sont désactivés (`enabled: !!chainId`). Aucune requête n'est envoyée → `totalCash = 0`.
2. **Table `chain_pos_connections` vide** : `useActiveChainPOSConnection()` renvoie `null` → `cashConnected = false` → la pastille "Connecter" reste affichée même sur Chicken Street, et le bloc "Aucune caisse connectée" se déclenche.
3. La data Splash360 est bien là (Chicken Street, restaurant_splash_id 418 = Reims, 761 jours × 3 plateformes, du 2024-05-01 au 2026-05-31).

## Ce qu'on va faire

### 1. Supporter le mode multi-marques dans les hooks Caisse
- `useNetworkCashRevenue` et `useRestaurantCashRevenue` : autoriser `chainId = null`.
  - Quand null → requête sur **toutes les chains accessibles** à l'utilisateur (via `useAccessibleChains` déjà utilisé ailleurs) en remplaçant `.eq("chain_id", chainId)` par `.in("chain_id", accessibleChainIds)`.
  - Le `enabled` devient `accessibleChainIds.length > 0`.
- Côté `useRestaurantCashRevenue`, on garde la Map clé = `restaurant_splash_id` mais on enrichit avec `chain_id` si nécessaire pour le mapping vers `restaurants.id`.

### 2. Connexion Splash360 implicite
Plutôt que de bloquer sur `chain_pos_connections`, considérer une marque "connectée" dès qu'elle a des lignes dans `splash360_daily_sales` sur la période.
- Ajouter un dérivé `hasSplashData = (cashRevenueData?.daysWithData ?? 0) > 0`.
- `cashConnected` devient `activePosConnection?.is_active || hasSplashData`.
- En mode multi-marques, afficher un sous-titre "X marque(s) connectée(s)" plutôt que "Aucune caisse connectée".

### 3. UX de la card Caisse en vue Réseau global
- Si au moins une marque a de la donnée Splash : afficher les KPIs agrégés (CA Caisse, cmds, panier, TVA, part dans CA réseau, variation N-1).
- Petite mention discrète : "Données issues de N marque(s) sur M".
- Le bouton "Connecter" reste visible pour ajouter d'autres caisses.

### 4. Tableau comparatif
- Les lignes des restos sans data Splash affichent `—` (déjà le cas).
- Les restos avec data (Reims) affichent CA, cmds, panier, part / CA, vs N-1.

## Détails techniques

- Fichiers modifiés :
  - `src/hooks/useNetworkCashRevenue.ts` : signature `chainId: string | null` → branche multi-marques avec `useAccessibleChains` (ou param `chainIds: string[]` injecté depuis Overview).
  - `src/hooks/useRestaurantCashRevenue.ts` : idem.
  - `src/pages/Overview.tsx` : passer `chainIds` au lieu de `chainId`, dériver `hasSplashData`, ajuster `cashConnected` et le bloc "Aucune caisse connectée".
- Aucune migration SQL nécessaire — on n'insère pas de ligne dans `chain_pos_connections` pour ne pas masquer la marketplace de connecteurs (`Splash360` reste un connecteur officiel).
- Pas d'impact sur les autres canaux (Uber/Deliveroo) : changements isolés au scope Caisse.

## Vérification

- Bascule sur Chicken Street seule → la card affiche le CA Caisse Reims pour 2025, et la ligne Reims apparaît dans le comparatif avec ses KPIs.
- Reste en vue Réseau global → mêmes chiffres (puisque seule Chicken Street a de la data Splash) + mention "1 marque sur 2".
- Bascule sur TASTY seule → "Aucune caisse connectée" + bouton Connecter (comportement actuel conservé).
