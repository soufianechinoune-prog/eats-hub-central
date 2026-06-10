# Fix : bouton "Rafraîchir le mapping Dishop" inopérant

## Diagnostic
- 84 mappings Dishop existent en base pour la connexion Chicken Street.
- Pourtant l'UI affiche "Aucun shop encore détecté" et le clic sur le bouton vert ne déclenche aucune requête réseau visible.
- Causes possibles non mutuellement exclusives :
  1. `chainConnectionId` arrive `undefined` (marque active ≠ Chicken Street ou `activeConnections` pas encore chargé) → `enabled:false` rend `refetch()` silencieux.
  2. La requête part mais retourne `[]` à cause d'une erreur RLS / utilisateur sans `user_chain_access`.
  3. Une erreur JS dans la query est avalée (pas de toast d'erreur sur `useDishopShopMapping`).

## Étapes

### 1. Rendre le composant verbeux et robuste
Dans `DishopIntegrationCard.tsx` :
- Ajouter une garde explicite : si `chainConnectionId` est falsy, afficher un message clair "Connexion Dishop non détectée pour la marque active — vérifie le sélecteur de marque".
- Surfacer l'erreur de `useDishopShopMapping` via un toast destructive (aujourd'hui silencieuse).
- Logger en console : `chainConnectionId`, `mappings.length`, `error` lors du clic refresh, pour confirmer en live ce qui se passe côté utilisateur.

### 2. Forcer un fetch sans cache au clic
Le `staleTime: 60_000` peut masquer une mise à jour récente. Changer le handler du bouton vert pour :
- invalider la queryKey via `queryClient.invalidateQueries(["dishop_shop_mapping"])` puis `refetch()`,
- afficher un toast "Mapping rafraîchi : N shops" pour donner un feedback visible même quand N = 0.

### 3. Reproduire dans le navigateur (mode build)
- Ouvrir `/settings/integrations` via `browser--view_preview`.
- Vérifier dans la console les logs ajoutés et l'éventuelle erreur Supabase.
- Confirmer que la requête `GET …/dishop_shop_mapping?…` part bien et avec quel statut.

### 4. Selon le résultat
- Si la requête part et renvoie 200 vide → c'est un problème d'utilisateur/marque : ajouter dans l'UI un message expliquant le mismatch (`chain_id` de la connexion vs `selectedChainId`).
- Si 403/permission denied → vérifier `user_chain_access` pour l'utilisateur courant et corriger l'accès.
- Si `chainConnectionId` undefined → corriger `Integrations.tsx` pour rendre la carte uniquement quand `selectedChainId` correspond à la chain_id de la connexion, et afficher un placeholder explicatif sinon.

## Hors scope
- Pas de modification de schéma DB ni des triggers.
- Pas de changement de la logique d'import Dishop.
