

# Corrections auto-remplissage SIRET

## Ce que je vois dans les screenshots
- Le SIREN reste "Non renseigné" alors qu'on le récupère du SIRET
- La dénomination sociale reste "Non renseigné" alors que l'API retourne "CS ATHIS"
- Le dirigeant "DIALLO" s'affiche dans la validation mais n'est pas renseigné dans le formulaire

## Changements

### 1. Supprimer le champ SIREN du formulaire
Le SIREN est redondant (c'est les 9 premiers chiffres du SIRET). On le retire de l'affichage.

### 2. Ajouter un champ "Dirigeant" dans la section Informations générales
Nouveau champ texte (lecture seule ou éditable) qui affiche le nom du dirigeant récupéré via le SIRET. On stocke dans un nouveau champ ou on concatène prénom+nom du dirigeant dans un champ dédié.

Plutôt que créer une nouvelle colonne, on peut simplement utiliser les champs `manager_first_name` et `manager_last_name` existants dans la table restaurants et les afficher aussi dans la section "Informations générales" sous le label "Dirigeant". Non -- le gérant (section Gérant) est déjà rempli séparément. Il faut un champ distinct pour le dirigeant légal.

On va ajouter une colonne `dirigeant_legal` (TEXT) à la table restaurants.

### 3. Modifier `handleSiretAutoFill` pour remplir correctement
- `denomination_sociale` ← denomination de l'API
- `dirigeant_legal` ← prénom + nom du dirigeant
- `street`, `postal_code`, `city` ← adresse parsée
- Retirer le mapping vers `siren`

### Fichiers modifiés
- **Migration SQL** : ajouter colonne `dirigeant_legal` à `restaurants`, supprimer l'affichage SIREN
- **`src/pages/RestaurantDetail.tsx`** : retirer le champ SIREN, ajouter le champ Dirigeant, corriger le handleSiretAutoFill
- **`src/components/restaurants/SiretValidation.tsx`** : pas de changement nécessaire

