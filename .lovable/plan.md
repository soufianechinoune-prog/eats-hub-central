
Objectif
- Rendre la barre de progression “Uber One” visuellement remplie (elle est calculée mais la couleur de remplissage ne s’applique pas).
- Afficher réellement 2–3 courbes quand 2–3 restaurants sont sélectionnés (mode “par restaurant”), sans dépendre d’un état ambigu “visible vs sélectionné”.

Constats (depuis le code actuel)
1) Barre de progression non visible
- Dans `src/components/analytics/UberOneAnalysis.tsx`, le remplissage utilise des classes Tailwind `bg-chart-1` / `text-chart-1`.
- Or dans `tailwind.config.ts`, il n’y a pas de palette `chart` déclarée (seulement `stat`, `uber`, etc.).
- Résultat probable: `bg-chart-1` / `text-chart-1` ne génèrent pas de CSS => le “fill” est transparent, donc on voit le conteneur mais pas la barre.

2) Courbes multi-restaurants non affichées
- Le mode “detailed” trace une `Line` par restaurant à partir de `byRestaurant` (dérivé de `rawData`) et utilise `evolutionByRestaurant` (objet par mois avec clés = restaurantId).
- Si `selectedRestaurants` ne contient pas vraiment 2–3 IDs “actifs” (cas fréquent avec votre UX où un restaurant peut être “affiché” mais désélectionné via les badges), `useUberOneStats` ne récupère potentiellement qu’un sous-ensemble.
- Autre point: l’UI n’indique pas clairement si vous êtes en mode “Moyenne” ou “Par restaurant”; vous pouvez avoir 3 restaurants “affichés” mais 1 seul réellement “sélectionné”, donc une seule courbe possible.

Solution proposée (robuste)
A) Corriger définitivement les couleurs `chart-*` dans Tailwind (solution “propre” et globale)
1. Modifier `tailwind.config.ts` pour ajouter:
   - `colors: { chart: { 1: "hsl(var(--chart-1))", 2: ..., 5: ... } }`
   - Cela activera `bg-chart-1`, `text-chart-1`, etc. partout dans l’app.
2. En complément (optionnel mais sûr): sur la barre de progression, remplacer le fond Tailwind par un inline style `backgroundColor: "hsl(var(--chart-1))"` pour garantir l’affichage même si un build cache une config (rare mais possible). On peut choisir l’une des deux approches; je recommande surtout la config Tailwind.

B) Rendre le “mode par restaurant” fiable et aligné avec ce que vous voyez à l’écran
1. Dans `useUberOneStats.ts`
   - Introduire la notion d’IDs “effectifs” plus explicite:
     - Si `restaurantIds` (selected) est vide: fallback pinned (déjà fait)
     - Mais aussi: si vous voulez que “les restaurants affichés” soient les courbes, on peut (au choix) baser le détail sur:
       - Option 1 (strict): uniquement les restaurants sélectionnés (actuels)
       - Option 2 (plus intuitive pour vous): les restaurants visibles (affichés) quand c’est disponible dans le contexte
   - Comme `useUberOneStats` ne reçoit aujourd’hui que `restaurantIds`, on va ajuster côté composant (UberOneAnalysis) pour lui fournir la liste qui correspond à l’intention utilisateur.

2. Dans `UberOneAnalysis.tsx`
   - Récupérer `visibleRestaurants` depuis `useAnalyticsContext()` en plus de `selectedRestaurants`.
   - Définir `restaurantIdsForDetailed`:
     - Si `selectedRestaurants.length >= 2` => utiliser `selectedRestaurants`
     - Sinon si `visibleRestaurants.length >= 2` => utiliser `visibleRestaurants`
     - Sinon => fallback (comme aujourd’hui)
   - Appeler `useUberOneStats({ restaurantIds: restaurantIdsForDetailed, ... })`
   - Ajuster `canShowDetailed`:
     - Basé sur le nombre de restaurants réellement utilisés pour le graphe (pas sur `byRestaurant.length` uniquement).
   - UX: si l’utilisateur a >=2 restaurants, on peut automatiquement passer en mode “detailed” (ou au minimum afficher un libellé “Moyenne / Par restaurant” + état actif très clair).

3. Sécuriser les séries dans Recharts (cas mois sans data)
   - Normaliser la série: pour chaque mois, garantir que chaque restaurant sélectionné a une valeur (null) plutôt qu’absence de clé, afin que Recharts trace correctement (et que la légende s’affiche). Aujourd’hui il peut manquer la clé du restaurant sur certains mois.
   - Concrètement: au moment de construire `evolutionByRestaurant`, forcer l’ajout de toutes les clés restaurants attendues pour chaque point mensuel.

Fichiers à modifier
- `tailwind.config.ts`
  - Ajouter la palette `chart` (chart-1..chart-5).
- `src/components/analytics/UberOneAnalysis.tsx`
  - Utiliser `visibleRestaurants` pour déterminer la liste réellement “à tracer”.
  - Rendre le toggle plus explicite et éventuellement auto-switch en “detailed” quand >=2 restaurants.
- `src/hooks/useUberOneStats.ts`
  - Normaliser `evolutionByRestaurant` pour inclure toutes les clés restaurants attendues chaque mois (évite “pas de courbes” selon la période).
  - (Optionnel) Retourner aussi la liste `effectiveRestaurantIds` si besoin pour debug/affichage.

Validation (ce que je vérifierai après implémentation)
1) Barre:
- À 60% Uber One, la barre violette/bleue se remplit visiblement à ~60% sur fond gris.
- Même résultat en mode sombre.

2) Courbes:
- Avec 2 restaurants sélectionnés, on voit:
  - 2 courbes distinctes (couleurs différentes) + légende.
  - Tooltip qui affiche la valeur + le nom restaurant correct.
- Avec 3 restaurants, 3 courbes.
- Sur une période où un restaurant a 0 commandes un mois donné, la courbe présente un trou (null) mais les autres restent visibles.

Questions de clarification (rapides, pour choisir l’option la plus intuitive)
- Quand vous dites “je sélectionne 2 ou 3 restaurants”, vous parlez:
  1) des “chips” bleus dans la barre “Restaurants:” (affichés) ?
  2) ou du fait qu’ils sont vraiment “actifs” (chips bleus vs gris/atténués) ?
- Vous préférez que le mode “Par restaurant” trace:
  - uniquement les restaurants actifs (sélectionnés),
  - ou tous les restaurants affichés, même si certains sont désélectionnés ?

Dès que vous confirmez ces 2 points (ou si vous me dites “par défaut: tous les affichés”), j’implémente la version la plus logique pour votre usage.