# Refonte de la liste des restaurants — colonne Connexions

## Objectif

Avoir, en un coup d'œil, sur quels canaux chaque restaurant est connecté (Caisse, Uber, Deliveroo, Dishop, Châtaigne), au lieu d'un simple badge "Succursale" peu informatif. On gagne de la place en compactant les colonnes Contact + Gérant.

## Nouvelles colonnes (vue desktop)

```text
| ★ | Nom + Ville | Gérant (compact) | Ouverture | Connexions                    | Statut | → |
|   |             | Nom + 📞 icône   | Uber       | 🟢U 🟢D ⚪Di ⚪Ch 🟢C        | Actif  |   |
```

- **Nom + Ville** fusionnés en une seule colonne (nom en gras, ville en sous-titre gris) → libère 1 colonne.
- **Gérant (compact)** : nom du gérant + icône 📞 cliquable (au survol → numéro complet en tooltip, clic → tel:). Plus de colonne "Contact" séparée.
- **Ouverture Uber** conservée (info utile pour l'ancienneté).
- **Connexions** : **nouvelle colonne**, 5 pastilles côte à côte (voir détail ci-dessous).
- **Statut** : Actif / Fermé / Migration (déjà présent).
- **Succursale** : retiré de la table principale. L'info reste éditable dans le formulaire et visible dans la fiche détaillée.

## Détail de la colonne "Connexions"

5 mini-pastilles rondes alignées, chacune avec une lettre/icône :

| Canal | Pastille | Source de vérité |
|---|---|---|
| **C**aisse | `C` (vert si connectée) | `chain_pos_connections.is_active = true` (splash360 ou zelty) + ligne dans `splash360_restaurant_mapping` pour ce resto |
| **U**ber Eats | `U` | `restaurants.uber_store_id IS NOT NULL` et pas de `uber_closing_date` passée |
| **D**eliveroo | `D` | `restaurants.deliveroo_id IS NOT NULL` et pas de `deliveroo_closing_date` passée |
| Di**s**hop | `Di` | `chain_pos_connections.connector_id = 'dishop'` actif sur la chaîne |
| **Ch**âtaigne | `Ch` | À confirmer — colonne ou table à créer si pas encore présente |

Codes couleur :
- **Vert plein** : connecté + données qui remontent (au moins 1 ligne ≤ 7 jours)
- **Vert clair** : connecté mais pas de data récente (alerte muette)
- **Gris** : non connecté
- **Rouge** : connecté mais en erreur (ex. credentials manquantes côté Splash)

Tooltip au survol de chaque pastille : libellé complet + dernière sync (ex. "Splash360 — dernière donnée il y a 12 min").

## Comportement

- Tri par "Connexions" : trie par nombre de canaux actifs (descendant).
- Filtre rapide existant ("Tous les statuts") élargi à : "Tous", "Sans caisse", "Sans Uber", "Sans Deliveroo", "100% connecté".
- Au survol d'une ligne, mini-popover synthèse "Caisse 7j : 4 800 €, Uber 7j : 9 200 €…".

## Formulaire "Ajouter / modifier un restaurant"

Pour respecter ta demande ("même quand on rajoute un restaurant, savoir s'il est activé"), j'ajoute une section **Connexions** dans le formulaire `RestaurantFormDialog` :

```text
┌─ Connexions ──────────────────────────────┐
│ ☐ Caisse Splash360  → ID interne : [____] │
│ ☐ Caisse Zelty       → ID interne : [____] │
│ ☐ Uber Eats          → Store UUID : [___] │
│ ☐ Deliveroo          → Brand ID   : [___] │
│ ☐ Dishop             → Auto via marque    │
│ ☐ Châtaigne          → ID         : [___] │
└────────────────────────────────────────────┘
```

Chaque case cochée écrit dans la bonne table (`restaurants.uber_store_id`, `splash360_restaurant_mapping`, etc.). Une case décochée désactive sans supprimer l'historique.

## Mobile (< 1024 px)

Sur mobile la table devient une liste de cartes. Chaque carte :
```text
★  Chicken Street – Marseille 1
   📍 13001 Marseille · 👤 Jamal · 📞
   🟢U 🟢D ⚪Di ⚪Ch 🟢C        [Actif]
```

## Étapes d'implémentation

1. **Nouveau hook `useRestaurantConnections(restaurantId | restaurantIds[])`** qui retourne pour chaque resto : `{ uber, deliveroo, dishop, chataigne, caisse: { active, lastSyncAt, hasRecentData } }`. Une seule RPC `get_restaurants_connections_summary(p_chain_id)` côté Postgres pour éviter N+1.
2. **Nouveau composant `<ConnectionChips restaurantId />`** réutilisable (table + carte mobile + fiche détaillée).
3. **Refonte `src/pages/Restaurants.tsx`** : fusionner Nom+Ville, compacter Contact dans Gérant, retirer Succursale, ajouter colonne Connexions.
4. **Ajouter section Connexions dans `RestaurantFormDialog.tsx`** + handlers pour persister chaque champ dans la bonne table.
5. **Tri & filtres** : adapter la logique `handleSort` et le `Select` "Tous les statuts" pour les nouveaux filtres "Sans caisse", etc.
6. **Tests visuels** : 1638 px (desktop), 1024 px (tablette), 390 px (mobile).

## Points à confirmer avant implémentation

1. **Châtaigne** : c'est quel type de connecteur ? (POS, plateforme de livraison, ERP ?) Il n'existe pas encore dans le projet — il faudra l'ajouter à la liste des connecteurs ou prévoir un champ `restaurants.chataigne_id` simple.
2. **Source de vérité Uber/Deliveroo "connecté"** : est-ce la simple présence du `store_id` / `deliveroo_id`, ou veux-tu qu'on considère "connecté = encore des commandes sur les 7 derniers jours" ?
3. **Suppression Succursale de la table** : OK pour la retirer complètement de la vue liste (toujours éditable dans le formulaire), ou tu veux la garder en petit badge à côté du nom ?
4. **Ouverture Uber** : on garde la colonne, ou on la déplace aussi dans la fiche détaillée pour gagner de la place ?

Dis-moi tes réponses sur ces 4 points et j'implémente.
