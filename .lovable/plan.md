

# Nettoyage des 3 restaurants sans UUID + badge "Ferme"

## 1. Supprimer Villeurbanne La Perraliere (doublon)

Le restaurant `CHICKEN STREET VILLEURBANNE LA PERRALIERE` (`4025b1f7...`) n'existe pas dans le CSV. Le vrai Villeurbanne est `Chicken Street - Villeurbanne` (`9f8dfc4f...`, UUID `113e3029...`).

**Donnees du doublon** : 173 commandes, 0 avis, 0 dispo horaires.

Actions :
1. Migrer les commandes uniques vers le vrai Villeurbanne (en verifiant les doublons par `uber_order_id` ou `order_datetime` + `order_amount`)
2. Supprimer les commandes restantes du doublon
3. Supprimer la fiche restaurant `4025b1f7...`

## 2. Supprimer Nancy Place des Vosges (doublon)

Le restaurant `CHICKEN STREET NANCY PLACE DES VOSGES` (`2f06317f...`) n'existe pas dans le CSV. Le vrai Nancy est `Chicken Street - Nancy` (`e00f3db3...`, UUID `68d1d7f1...`).

**Donnees du doublon** : 96 commandes, 0 avis, 0 dispo horaires.

Actions :
1. Migrer les commandes uniques vers le vrai Nancy
2. Supprimer les commandes restantes du doublon
3. Supprimer la fiche restaurant `2f06317f...`

## 3. Mettre a jour Toulon (restaurant ferme)

Le restaurant `Chicken Street - Toulon` (`728c43f6...`) existe dans le CSV avec l'UUID `5ac13198-ed05-5bf2-8d73-30aa8f860bbf`.

Actions :
1. Mettre a jour `uber_store_id` avec l'UUID officiel
2. Definir `uber_opening_date` = `2023-06-12` (first_request_date)
3. Definir `uber_closing_date` = `2025-09-21` (date de fermeture)
4. Definir `is_active` = `false`
5. Mettre a jour l'adresse : "237 Boulevard Marechal Joffre, Toulon"
6. Marquer `csv_verified` = `true`

## 4. Ajouter un badge "Ferme" dans l'interface

Actuellement, les restaurants afichent un badge "Valide" / "En attente" / "Non connecte" base sur `csv_verified` et `uber_store_id`. Pour les restaurants fermes, on ajoutera un badge rouge "Ferme" avec la date de fermeture, qui remplace le badge Deliveroo (comme demande).

### Fichiers a modifier

**`src/pages/Restaurants.tsx`** :
- Ajouter un badge rouge "Ferme" a cote du nom ou dans la zone de statut pour les restaurants ou `is_active === false`
- Afficher la date de fermeture (`uber_closing_date`) si disponible

**`src/pages/RestaurantDetail.tsx`** :
- Ajouter un badge "Ferme" visible en haut de la fiche, avec la date de fermeture
- Remplacer le badge Deliveroo par cette information quand le restaurant est ferme

### Logique du badge

```text
Si is_active === false :
  -> Badge rouge "Ferme le [date]" (ou juste "Ferme" si pas de date)
Sinon :
  -> Comportement actuel (Valide / En attente / Non connecte)
```

## Resume des operations

| Restaurant | Action | Commandes a migrer |
|---|---|---|
| Villeurbanne La Perraliere | Supprimer (doublon) | 173 |
| Nancy Place des Vosges | Supprimer (doublon) | 96 |
| Toulon | Mettre a jour UUID + marquer ferme | 0 (donnees conservees) |
| Badge UI | Ajouter badge "Ferme" | — |

