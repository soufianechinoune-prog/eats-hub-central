

## Suppression de la section "Horaires d'ouverture" de la fiche restaurant

### Contexte

La page **"Analyse des Horaires"** (`/compare/opening-hours`) lit directement la table `restaurant_opening_hours` — elle est **indépendante** de l'éditeur dans la fiche restaurant. Les données déjà saisies restent en base et continuent d'alimenter l'analyse. Supprimer l'éditeur n'affecte en rien cette page.

### Changements

**`src/pages/RestaurantDetail.tsx`** :
1. Retirer l'import de `OpeningHoursEditor`
2. Retirer l'import de `OpeningHoursAnalytics`
3. Supprimer le rendu `<OpeningHoursEditor restaurantId={id!} />` (ligne ~553)
4. Supprimer le rendu `<OpeningHoursAnalytics>` s'il est présent dans la page

Les fichiers `OpeningHoursEditor.tsx`, `OpeningHoursAnalytics.tsx`, `useOpeningHours.ts` et la table `restaurant_opening_hours` sont **conservés** car utilisés par la page d'analyse des horaires.

C'est un changement minimal : suppression de 2-3 lignes d'import et 1-2 blocs de rendu.

