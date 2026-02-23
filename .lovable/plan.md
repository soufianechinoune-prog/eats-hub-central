

## Exclure les restaurants deja assignes des dropdowns

### Probleme
Actuellement, quand un restaurant en base est selectionne pour un nom Deliveroo, il reste disponible dans les dropdowns des autres lignes. Cela permet d'assigner le meme restaurant a plusieurs noms Deliveroo par erreur.

### Solution
Filtrer la liste des restaurants dans chaque dropdown pour exclure ceux qui sont deja selectionnes par une autre ligne (ou deja lies en base via `deliveroo_store_id`).

### Comportement attendu
- Un restaurant choisi pour "CHICKEN STREET - Besancon" disparait des dropdowns de toutes les autres lignes
- Si on change la selection ou qu'on remet "Aucun" / "En attente", le restaurant redevient disponible
- Les restaurants deja lies en base (badge "Deja lie") sont aussi exclus des dropdowns des autres lignes
- Chaque ligne garde toujours acces a son propre restaurant selectionne (pour ne pas casser l'affichage)

### Detail technique

**Fichier** : `src/pages/DeliverooMatching.tsx`

1. Calculer un `Set` des `selectedRestaurantId` deja utilises par les autres lignes (en excluant la ligne courante)
2. Ajouter les `restaurant.id` des restaurants qui ont deja un `deliveroo_store_id` non vide en base (deja lies a un autre nom Deliveroo)
3. Dans le `SelectContent`, filtrer les `restaurants` pour n'afficher que ceux dont l'id n'est pas dans ce Set
4. Ce calcul se fait via un `useMemo` qui depend de `matches` et `restaurants`

