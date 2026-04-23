

## Bouton "Copier UUID" dans la liste des restaurants

### Contexte
Sur Uber Eats Manager (cf. screenshot), un bouton "Copy Store UUID" est dispo en haut de la fiche restaurant. Aujourd'hui dans notre app, l'UUID Uber n'est copiable que depuis la fiche détail (`RestaurantDetail.tsx` ligne 657-661). Sur la liste `/restaurants`, il faut ouvrir la fiche pour le récupérer — peu pratique quand on doit le coller dans Uber.

### Proposition
Ajouter une **petite icône "copier"** discrète à côté de chaque restaurant dans la liste, qui copie son `uber_store_id` en un clic + toast de confirmation.

### Emplacement
Dans la cellule "Nom" du tableau (`Restaurants.tsx`), juste après le nom du restaurant : un bouton ghost icône `Copy` (lucide) de taille `h-6 w-6`, visible uniquement si `r.uber_store_id` existe.

### Comportement
- Clic → `navigator.clipboard.writeText(r.uber_store_id)` + toast "UUID copié"
- `e.stopPropagation()` pour éviter de naviguer vers la fiche détail
- Tooltip au survol : "Copier l'UUID Uber : `xxxx-xxxx`"
- Icône grise par défaut, devient verte 1s après le clic (feedback visuel rapide)
- Si pas d'UUID Uber : icône absente (pas d'état désactivé inutile)

### Variante optionnelle (à valider)
Ajouter aussi un second bouton pour le `deliveroo_store_id` à côté, avec la même mécanique. Actuellement les 2 plateformes sont représentées dans l'app, donc pertinent.

### Fichiers modifiés
- `src/pages/Restaurants.tsx` — ajout du bouton copier dans la `TableCell` du nom + import de l'icône `Copy` + handler local

### Résultat attendu
Depuis la liste, un clic sur l'icône à côté de "Chicken Street - Marseille Belsunce" copie son UUID Uber dans le presse-papier sans avoir à ouvrir la fiche. Workflow identique à celui d'Uber Manager.

