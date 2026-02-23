

## Ajouter un statut "En attente" pour le matching Deliveroo

### Objectif
Permettre de mettre certains restaurants en attente quand tu n'as pas encore l'info, et ne sauvegarder que ceux dont tu es sur. Tu pourras y revenir plus tard.

### Ce qui change

#### 1. Bouton "En attente" par ligne
- Ajouter un bouton pause/horloge sur chaque ligne non resolue
- Quand tu cliques, la ligne passe en statut "en attente" (fond jaune pale, badge "En attente")
- Le restaurant n'est pas sauvegarde et ne compte pas dans les correspondances a enregistrer
- Tu peux annuler le statut "en attente" pour revenir au mode normal

#### 2. Nouveau badge dans les compteurs
- Ajouter un compteur "X en attente" (badge jaune) dans la barre de stats en haut
- Les restaurants en attente sont exclus du bouton "Enregistrer"

#### 3. Tri adapte
- Les lignes en attente se regroupent apres les non-matches mais avant les deja lies et les ignores
- L'ordre devient : non trouves > a verifier > en attente > auto-matches > deja lies > ignores

#### 4. Option "En attente" dans le dropdown
- Ajouter une option "En attente" dans le Select a cote de "Aucun", pour marquer directement depuis le dropdown

### Comportement
- "En attente" = je ne sais pas encore, je reviendrai plus tard
- "Aucun" = ce restaurant n'a pas de correspondance (ne sera pas sauvegarde)
- Seules les lignes avec un restaurant selectionne (ni "aucun", ni "en attente") sont sauvegardees

### Fichier concerne

| Fichier | Action |
|---|---|
| `src/pages/DeliverooMatching.tsx` | Ajouter le state `isPending` par ligne, le bouton, le badge, le tri, et l'option dropdown |

Pas de changement en base ni dans d'autres fichiers.

