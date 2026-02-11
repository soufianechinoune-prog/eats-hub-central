
# Remplacer la colonne "AM Uber" par la date d'ouverture Uber

## Ce qui sera fait

### 1. Mise a jour des dates d'ouverture en base
Pour les restaurants verifies (`csv_verified = true`), mettre a jour `uber_opening_date` avec la valeur `first_request_date` du CSV Uber. Cela concerne notamment les restaurants ou la date est manquante ou incorrecte (calculee a partir des commandes au lieu du CSV officiel).

Restaurants concernes (date manquante ou a corriger) :
- **Plombieres** : null -> 2025-05-20
- **Roubaix** : null -> 2023-08-17
- **Marseille (13015)** : null -> 2021-03-22
- **Marseille Belsunce** : null -> 2022-06-22

Et verification/correction des dates existantes par rapport au CSV pour tous les autres restaurants verifies (certains ont des dates issues des commandes en base qui different du `first_request_date` officiel).

### 2. Modification de la colonne dans le tableau des restaurants
Remplacer la colonne **"AM Uber"** (qui affiche le nom de l'account manager Uber) par une colonne **"Ouverture Uber"** qui affiche la date `uber_opening_date` formatee en francais (ex: "17 aout 2023").

## Details techniques

### Base de donnees
Executer des UPDATE SQL pour les restaurants csv_verified dont la date d'ouverture doit etre corrigee/ajoutee a partir du CSV.

### Fichier modifie : `src/pages/Restaurants.tsx`
- Renommer l'en-tete de colonne "AM Uber" en "Ouverture Uber"
- Remplacer l'affichage du nom de l'account manager par la date `uber_opening_date` formatee
- Adapter le tri (`handleSort`) pour trier par date au lieu de par nom d'AM
- Afficher "-" si la date n'est pas renseignee
