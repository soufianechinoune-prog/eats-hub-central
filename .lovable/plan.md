## Objectif
Éviter de mapper deux caisses Splash sur le même restaurant en signalant visuellement, dans la liste déroulante « Restaurant rattaché », ceux qui sont **déjà rattachés** à une autre caisse.

## Modifications (UI uniquement, page `/admin/splash-mapping`)

Dans `src/pages/SplashMapping.tsx`, sur le `<Select>` de chaque ligne :

1. **Calculer un set des restaurant_id déjà mappés** à partir des mappings existants (déjà chargés dans la page).
2. **Pour chaque option restaurant** du dropdown :
   - Si le restaurant est déjà mappé à **une autre** caisse Splash → ajouter un badge `● Déjà mappé → [Nom Splash]` à droite, texte en gris/atténué.
   - Garder l'option **cliquable quand même** (l'utilisateur peut vouloir corriger un mauvais mapping), mais visuellement clair que c'est une réaffectation.
   - L'option reste mise en surbrillance verte uniquement si elle correspond à la suggestion automatique ET n'est pas déjà prise.
3. **Suggestion auto** : si le meilleur match est déjà pris, ne pas le surligner en vert — proposer le 2e meilleur match libre à la place.
4. **Recherche** : la recherche fonctionne toujours sur tous les restaurants (mappés ou non), pour permettre la correction.

## Détails techniques

- Construire `Map<restaurant_id, splash_caisse_name>` à partir de `splash360_restaurant_mappings` déjà fetchées.
- Dans le rendu de chaque `SelectItem`, ajouter une `<span>` secondaire avec le nom de la caisse Splash actuellement rattachée si `mappedRestaurants.has(r.id) && r.id !== currentRowMapping`.
- Aucune migration SQL, aucun changement back — purement frontend.

## Hors-scope
- Pas de blocage dur (on autorise la réaffectation volontaire).
- Pas de changement sur les compteurs en haut.
