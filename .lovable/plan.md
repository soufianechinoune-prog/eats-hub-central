## Objectif
Mettre à jour les UUID Uber des Tasty Crousty depuis le fichier Excel.

## Étape 1 — Créer 6 nouveaux restaurants
INSERT dans `restaurants` (chain_id Tasty Crousty, is_active=true, uber_store_id renseigné dès l'insertion) :

| Nom | UUID Uber |
|---|---|
| TASTY CROUSTY ANNEMASSE | c3887927-26d2-514e-b2da-421a00dd6626 |
| TASTY CROUSTY CACHAN | 3608d3a0-1560-5a22-8e96-4e6edc44092a |
| TASTY CROUSTY CHAMPS SUR MARNE | 857a9a83-81a1-5f8f-9c85-1e41017b50b4 |
| TASTY CROUSTY LENS | 73743b00-959f-5be7-a5d3-c492c4bdabc0 |
| TASTY CROUSTY PARIS 20 | 584a1128-a1aa-5dfd-8da1-17e4275926a8 |
| TASTY CROUSTY REPUBLIQUE | 6db1e4dc-e05f-509c-ab90-7ec8b9ae5d6e |

## Étape 2 — Mapper 52 UUIDs aux restos existants
Une migration avec 52 `UPDATE restaurants SET uber_store_id = ... WHERE id = ...` (matchs déjà identifiés : Le Mans, Aix, Amiens, Angers, Argenteuil, Athis-Mons, Aubervilliers, Aulnay, Auxerre, Avignon, Bobigny, Boulogne, Bruxelles, Bussy, Caen, Cergy, Chalon, Champigny, Châtelet, Chevilly, Conflans, Creil, Créteil, Créteil 2, Evry, Grenoble, Ivry, Kremlin-Bicêtre, La Rochelle, Le Havre, Les Mureaux, Lyon, Marseille La Pomme, Marseille St-Antoine, Meaux, Melun, Montigny, Montreuil, Nanterre, Nantes, Orléans, Paris 18, Paris 19, Pontault, Reims, Saint-Denis, Saint Etienne, Sainte Geneviève, Strasbourg, Toulouse Capitole, Troyes, Villeurbanne).

## Étape 3 — Vérification
SELECT de contrôle pour confirmer que 58 Tasty Crousty ont bien un `uber_store_id`.

## Reportés (à faire après)
- Mapping de "Marseille" (UUID `8bdc3bd0…`) → Garibaldi ?
- "Toulouse" (UUID `4ec2ed0e…`) → créer un nouveau resto ?
- 5 restos sans UUID Uber : Lyon Pardieu, Mulhouse, Nîmes, Paris 11, Pavillons sous Bois.
