

## Ajouter une nouvelle marque depuis le sélecteur

### Problème actuel
Le sélecteur de marques dans la sidebar liste uniquement les chaînes existantes. Il n'y a aucun moyen de créer une nouvelle marque depuis l'interface. De plus, quand on crée un restaurant, il est automatiquement rattaché à la première chaîne trouvée en base (ligne 104-108 du `RestaurantFormDialog`).

### Solution

**1. Ajouter un bouton "+ Nouvelle marque" dans le sélecteur de la sidebar**
- Fichier : `src/components/layout/AppSidebar.tsx`
- Ajouter une option en bas du `SelectContent` ou un petit bouton "+" à côté du sélecteur
- Au clic, ouvrir un mini-dialog demandant juste le **nom de la marque** (et optionnellement un logo)
- Après création, sélectionner automatiquement la nouvelle chaîne → la plateforme s'affiche vide, prête à recevoir des données

**2. Rattacher les nouveaux restaurants à la chaîne active**
- Fichier : `src/components/restaurants/RestaurantFormDialog.tsx`
- Au lieu de prendre la première chaîne en base (comportement actuel), utiliser `selectedChainId` du contexte
- Si une chaîne est sélectionnée → le nouveau restaurant y est rattaché automatiquement
- Si "Toutes les marques" est sélectionné → proposer de choisir la chaîne dans le formulaire

**3. Permettre de choisir la chaîne dans le formulaire restaurant**
- Ajouter un champ `Select` "Marque" dans le formulaire de création de restaurant
- Pré-rempli avec la chaîne active si une est sélectionnée

### Résultat
1. Tu cliques sur le sélecteur de marque → "+ Nouvelle marque"
2. Tu entres le nom (ex: "Burger Factory")
3. La plateforme switch automatiquement sur cette marque → tout est vide
4. Tu vas dans Restaurants → tu crées tes restaurants (auto-rattachés à la marque)
5. Tu importes tes rapports → les données apparaissent

### Fichiers modifiés
- `src/components/layout/AppSidebar.tsx` — bouton création de chaîne
- `src/components/restaurants/RestaurantFormDialog.tsx` — sélecteur de chaîne + utilisation du contexte

