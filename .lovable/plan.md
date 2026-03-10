

## Plan : Supprimer les pastilles orange, garder uniquement ⚠️ critique

Modification simple dans `src/pages/Restaurants.tsx` (lignes 473-500) :

- Si le restaurant a des annonces BODACC **avec alerte critique** → afficher ⚠️ `AlertTriangle` (inchangé)
- Si le restaurant a des annonces BODACC **sans alerte critique** → ne rien afficher (supprimer la pastille orange)
- Le clic sur ⚠️ ouvre toujours le sheet de détail

Concrètement : envelopper le bloc `bodaccResults.has(restaurant.id)` avec la condition `hasCritical` pour ne rendre le bouton que dans ce cas.

**1 fichier modifié** : `src/pages/Restaurants.tsx` (~5 lignes changées)

