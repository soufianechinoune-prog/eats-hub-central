# Badge "Connecté Uber" sur la liste des restaurants

## Objectif

Voir d'un coup d'œil, pour chaque restaurant (toutes enseignes), s'il est provisionné côté API Uber — directement dans le tableau de la page `/restaurants`.

## Signal utilisé

Le champ `restaurants.uber_pos_activated_at` (date d'activation POS Reporting Uber) est le meilleur indicateur de provisioning API :
- Chicken Street : 103 restaurants POS activés sur 106 avec UUID
- Tasty Crousty : 62 sur 62 avec UUID

Il est déjà chargé par la requête existante (`select *`), donc **aucune requête supplémentaire**.

## Modifications (un seul fichier : `src/pages/Restaurants.tsx`)

### 1. Nouvelle colonne "Uber API" dans le tableau

Insérée juste après la colonne "Nom" (ou "Ouverture Uber"), avec 3 états :

| État | Condition | Badge |
|---|---|---|
| Connecté API | `uber_pos_activated_at` renseigné | Badge émeraude avec logo Uber + coche : "Connecté API" — tooltip : "Store provisionné par Uber le JJ mois AAAA (POS Reporting actif)" |
| UUID enregistré | `uber_store_id` renseigné sans activation POS | Badge ambre : "En attente Uber" — tooltip : "UUID enregistré, provisioning Uber pas encore actif" |
| Non connecté | aucun UUID | Badge gris discret : "Non connecté" |

Le badge utilise le composant `UberEatsLogo` existant (`src/components/icons/PlatformIcons.tsx`).

### 2. Tri et filtre

- Colonne triable (clic sur l'en-tête : tri Connecté → En attente → Non connecté), cohérent avec les autres colonnes.
- Le filtre "Statut API" existant est aligné : "Validé" passera sur `uber_pos_activated_at` au lieu de `csv_verified` (qui ne couvre que Chicken Street et sous-estime Tasty Crousty).

### 3. Compteur en tête de carte

À côté du badge "77 restaurants au total", ajout d'un compteur : `62/77 connectés API` pour une vue réseau immédiate.

## Ce qui ne change pas

- Aucune modification de base de données ni d'edge function.
- Aucun impact sur les exports CSV/PDF, le scan BODACC ou les autres colonnes.

## Vérification

- Capture d'écran de la liste avec les 3 états de badge (CS + TC).
- Vérifier que le tri et le filtre fonctionnent.
