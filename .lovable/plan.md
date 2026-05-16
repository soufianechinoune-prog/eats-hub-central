# Sous-ligne Caisse (Splash) au dépliage des restaurants

## Contexte

Aujourd'hui, dans le tableau « Comparatif des restaurants » (page Overview), quand on déroule un restaurant via le chevron, deux sous-lignes apparaissent : **Uber Eats** (vert) et **Deliveroo** (cyan), via le composant `PlatformSubRow`. Elles affichent la part du CA, le CA, le versement, la rentab., les commandes, le panier, la note, etc.

Tu te souviens bien : on a fait Uber + Deliveroo, mais **on n'a jamais ajouté la 3ᵉ ligne Caisse (Splash)**. La colonne « Caisse » existe au niveau RÉSEAU (en haut, agrégée via `useNetworkCashRevenue`), mais sur chaque ligne restaurant et dans le dépliage, on affiche simplement « — ».

C'est pile le bon moment pour la brancher maintenant que Reims est en cours de backfill.

## Ce qu'on va faire

Ajouter une 3ᵉ sous-ligne **Caisse** au dépliage d'un restaurant, alimentée par `splash360_daily_sales`, avec le même style visuel que Uber/Deliveroo mais en couleur "cash" (token déjà présent : `text-cash`).

### Comportement

- Quand on déroule un restaurant :
  - Sous-ligne **Uber Eats** (existante)
  - Sous-ligne **Deliveroo** (existante)
  - **Nouvelle sous-ligne Caisse** : affichée uniquement si le restaurant a au moins 1 € de caisse sur la période (sinon masquée, comme on le fait déjà pour Uber/Deliveroo via `if (data.orders === 0 && data.revenue === 0) return null`).
- Colonnes alimentées sur la sous-ligne Caisse :
  - `% du CA` (part Caisse / CA total du resto incluant Caisse)
  - `Caisse` (CA TTC Splash, colonne dédiée)
  - `CA` (= même valeur que Caisse, pour cohérence visuelle)
  - Toutes les autres colonnes (Versement, Titre resto, Rentab., %Pub, Cmds, Panier, Note, Erreurs, Prépa+Livr, Inactiv.) → « — » (Splash ne fournit pas ces métriques)
- Sur la ligne **principale** du restaurant : la colonne « Caisse » (aujourd'hui « — ») doit afficher la valeur réelle par restaurant (et non plus uniquement au niveau Réseau).

### Implication sur le CA total

À discuter (voir question ouverte plus bas) : faut-il **ajouter** le CA caisse au CA total affiché du restaurant, ou le garder séparé comme une colonne parallèle (comme aujourd'hui) ? Recommandation : **garder séparé** dans un premier temps pour ne pas casser les comparaisons N-1 et les autres pages qui se basent sur le CA plateformes uniquement. La ligne Caisse afficherait alors sa propre valeur dans la colonne dédiée + une part « % du CA + Caisse » à titre indicatif.

## Détails techniques

### Source de données

Table `splash360_daily_sales` :
- Filtrer par `chain_id`, `granularity = 'day'`, `platform = 'global' | 'uber_eats' | 'deliveroo'`, `restaurant_splash_id != 0` (lignes par restaurant)
- Mapping `restaurant_splash_id` → `restaurants.id` via `restaurants.splash_restaurant_id` (à confirmer : colonne existante)
- Formule par jour et par resto : `caisse = max(0, global - uber_eats - deliveroo)`
- Agrégation sur la période sélectionnée

### Nouveau hook

`src/hooks/useRestaurantCashRevenue.ts` :
- Input : `chainId`, `restaurantIds[]`, `startDate`, `endDate`
- Output : `Map<restaurantId, { totalCash: number; daysWithData: number }>`
- Pagination via `while + .range()` (standard projet, `PAGE_SIZE = 1000`)
- `staleTime: 5 min`
- Réutilise la même logique d'agrégation que `useNetworkCashRevenue` mais groupée par `restaurant_splash_id` au lieu de globale

### Modifications de composants

1. **`useRestaurantCashRevenue.ts`** (nouveau) — fetch + agrégation par resto.
2. **`Overview.tsx`** (page parent) — appeler le hook et passer `cashByRestaurant: Map<string, number>` à `<RestaurantComparisonTable>`.
3. **`RestaurantComparisonTable.tsx`** :
   - Nouveau prop `cashByRestaurant?: Map<string, number>`
   - Remplacer le `—` de la colonne Caisse (ligne resto) par la valeur du map
   - Ajouter une 3ᵉ sous-ligne `<CashSubRow>` dans le bloc `isExpanded`, ou étendre `PlatformSubRow` avec un mode `cash` (préférable : nouveau petit composant `CashSubRow` car les colonnes alimentées sont très différentes).

### Style

- Badge platform : `Caisse` avec bordure couleur `text-cash` (token déjà défini), icône `Store` de lucide-react
- Même typo / tailles que les sous-lignes existantes

## Question ouverte avant implémentation

- **Périmètre data** : Reims est encore en cours de backfill (~25 jobs). On affiche la sous-ligne Caisse pour **tous les restaurants** qui ont de la data Splash (donc dès maintenant : Reims + ce qui aura été conservé), ou bien on la garde **masquée tant que la donnée est incomplète** ? Recommandation : afficher dès qu'il y a >0 €, le filtre `if revenue === 0 return null` masquera naturellement les restos sans data.

Si tu valides, j'implémente d'un coup les 3 fichiers.
