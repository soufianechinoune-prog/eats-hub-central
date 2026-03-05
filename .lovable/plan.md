

# Vérification d'adhésion éco-organismes via SIRET (API ADEME)

## Faisabilité : Oui, 100% faisable

L'API ADEME est **publique, gratuite, sans clé API** (600 req/min en anonyme). J'ai testé : une recherche par SIRET via `identifiant_societe` retourne toutes les filières REP auxquelles la société est inscrite (éco-organismes, catégories d'agrément, dates d'inscription).

Exemple de réponse pour le SIRET `83085403000012` : 7 résultats avec les filières ABJ (ameublement), ASL (DEEE), BAT (piles), EEE (électronique), EA (emballages), etc.

## Ce qu'il faut construire

### 1. Ajouter le champ SIRET aux restaurants
- Migration : colonne `siret TEXT` sur la table `restaurants`
- Modifier le formulaire `RestaurantFormDialog` pour permettre la saisie du SIRET

### 2. Edge function `check-eco-organism`
- Reçoit un SIRET, appelle `https://data.ademe.fr/data-fair/api/v1/datasets/rep-adherents-eo-fin-annee/lines?q_fields=identifiant_societe&q={siret}&size=100`
- Retourne la liste des filières REP, éco-organismes associés, et dates d'inscription
- Pas besoin de clé API

### 3. Intégration dans la page Éco-Contribution
- Nouveau bouton/section "Vérifier adhésion REP" dans le bandeau ou sous les KPI
- Pour chaque restaurant sélectionné ayant un SIRET, afficher son statut d'adhésion :
  - Nombre de filières REP actives
  - Liste des éco-organismes (ECOMAISON, ECOLOGIC, CITEO, etc.)
  - Catégories d'agrément
- Indicateur visuel : badge vert "Adhérent" ou rouge "Non trouvé" par restaurant

### 4. Champs retournés par l'API (utiles)
| Champ | Description |
|-------|-------------|
| `identifiant_societe` | SIRET recherché |
| `raison_sociale` | Nom de la société |
| `filiere` | Code filière REP (ABJ, EA, EEE...) |
| `raison_sociale_ecoorganisme` | Nom de l'éco-organisme |
| `categorie_agrement` | Catégories d'agrément |
| `date_debutvalidite_inscription` | Date d'inscription |

## Fichiers modifiés/créés
- **Migration SQL** : ajout colonne `siret` sur `restaurants`
- **`supabase/functions/check-eco-organism/index.ts`** : edge function proxy vers l'API ADEME
- **`src/hooks/useEcoOrganismCheck.ts`** : hook React pour appeler la function
- **`src/components/analytics/EcoContributionSection.tsx`** : intégration UI
- **`src/components/restaurants/RestaurantFormDialog.tsx`** : champ SIRET dans le formulaire

