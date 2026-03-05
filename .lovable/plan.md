

# Afficher la dénomination sociale sans toucher le nom

## Problème
L'auto-remplissage risque d'écraser le champ "Nom" du restaurant, qui est utilisé pour le matching des imports. Il ne faut jamais le modifier automatiquement.

## Solution

1. **Ajouter un champ `denomination_sociale` en base** via migration :
   - Nouvelle colonne `denomination_sociale TEXT` sur la table `restaurants`

2. **Modifier `handleSiretAutoFill`** dans `RestaurantDetail.tsx` :
   - Retirer toute logique qui toucherait au champ `name`
   - Stocker `data.denomination` dans le nouveau champ `denomination_sociale`

3. **Afficher la dénomination à côté du nom** dans la grille "Informations générales" :
   - Ligne 1 : "Nom" (inchangé) | "Dénomination sociale" (nouveau champ, lecture seule ou éditable, rempli automatiquement par le SIRET)

4. **Fichiers modifiés** :
   - `src/pages/RestaurantDetail.tsx` — ajout du champ dénomination sociale dans le formulaire et dans `handleSiretAutoFill`
   - Migration SQL — ajout colonne `denomination_sociale` à `restaurants`

