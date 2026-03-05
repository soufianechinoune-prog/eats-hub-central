

# Auto-remplissage des champs restaurant via le SIRET

## Ce qu'on peut récupérer gratuitement

J'ai testé l'API qu'on utilise déjà (`api.recherche-entreprises.fabrique.social.gouv.fr`). Pour le SIRET `91040580200026`, elle retourne :

```text
address:         "1 RUE DES ECLUSES 57100 THIONVILLE"
codePostal:      "57100"
commune:         "THIONVILLE"
siren:           "910405802"
activitePrincipale: "56.10C" (Restauration de type rapide)
categorieJuridique: "5710" (SARL)
categorieEntreprise: "PME"
dateCreation:    "2022-02-16"
etatAdministratif: "A" (Actif)
```

On peut donc **auto-remplir** :
- **Adresse** (rue, code postal, ville) -- parsée depuis le champ `address`
- **SIREN** -- extrait automatiquement du SIRET
- **Dénomination** -- nom légal de l'entreprise

Pour les **dirigeants** (gérant, prénom, nom), il existe l'API DINUM (`recherche-entreprises.api.gouv.fr/search`) qui inclut les dirigeants dans ses résultats. Elle est gratuite et publique (7 appels/seconde). Cependant, elle était temporairement indisponible lors de mes tests. On peut l'intégrer en fallback.

## Plan d'implémentation

### 1. Enrichir la edge function `validate-siret`
Ajouter dans la réponse les champs structurés : `rue`, `codePostal`, `ville`, `siren`, `activite`, `formeJuridique`, `dateCreation`. Parser le champ `address` de l'API pour séparer rue / CP / ville.

### 2. Bouton "Auto-remplir" sur la fiche restaurant
Quand la validation SIRET réussit, afficher un bouton "Remplir les champs" qui pré-remplit automatiquement :
- Rue, Code postal, Ville
- SIREN
- Dénomination (dans le champ Nom si vide)

### 3. Tentative de récupération des dirigeants (bonus)
Appeler l'API DINUM en complément pour essayer de récupérer le nom du gérant. Si l'API est disponible, on pré-remplit le champ gérant. Sinon, on skip silencieusement.

### Fichiers modifiés
- `supabase/functions/validate-siret/index.ts` -- enrichir la réponse
- `src/components/restaurants/SiretValidation.tsx` -- bouton auto-remplir
- `src/pages/RestaurantDetail.tsx` -- callback pour recevoir les données et remplir le formulaire

