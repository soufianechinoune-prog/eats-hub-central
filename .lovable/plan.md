

## Ajout du champ "Succursale" aux restaurants

### Objectif
Remplacer la colonne "Connexions" du tableau des restaurants par une colonne "Succursale" (Oui/Non), et rendre cette information editable dans la fiche du restaurant.

### 1. Modification de la base de donnees
Ajouter une colonne `is_succursale` (boolean, defaut `false`) a la table `restaurants` :

```sql
ALTER TABLE restaurants ADD COLUMN is_succursale boolean DEFAULT false;
```

### 2. Page liste des restaurants (`src/pages/Restaurants.tsx`)
- Remplacer l'en-tete "Connexions" par "Succursale"
- Remplacer le contenu de la cellule (logos Uber/Deliveroo avec pastilles) par un badge :
  - **Oui** : Badge vert "Succursale"
  - **Non** : Affichage "-" ou badge discret "Franchise"
- Ajouter le tri sur cette colonne

### 3. Fiche restaurant (`src/pages/RestaurantDetail.tsx`)
- Ajouter le champ "Succursale" dans la carte "Informations generales"
- En mode lecture : afficher "Oui" ou "Non"
- En mode edition : afficher un Switch (toggle) pour basculer entre succursale et franchise
- Inclure `is_succursale` dans le `formData` et dans la logique de sauvegarde

### 4. Formulaire de creation (`src/components/restaurants/RestaurantFormDialog.tsx`)
- Ajouter un toggle "Succursale" dans la section "Informations generales"
- Inclure `is_succursale` dans le formulaire et l'insertion en base

### Resume des fichiers modifies
| Fichier | Modification |
|---|---|
| Migration SQL | Ajout colonne `is_succursale` |
| `src/pages/Restaurants.tsx` | Colonne "Connexions" remplacee par "Succursale" |
| `src/pages/RestaurantDetail.tsx` | Champ succursale en lecture/edition |
| `src/components/restaurants/RestaurantFormDialog.tsx` | Toggle succursale dans le formulaire de creation |

