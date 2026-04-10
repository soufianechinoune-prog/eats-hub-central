

# Correction : le sampling de validation rate les restaurants inconnus

## Problème

La validation (étape 3) échantillonne **1 000 lignes** uniformément sur 350 156 lignes (step = 350). Si "Chicken Street - Lens" représente ~7% des données, l'échantillon peut en capter quelques lignes, mais le résultat est affiché comme "~0 À ignorer" car c'est une estimation.

**Le vrai bug** : l'UI affiche les compteurs comme des estimations (`~`) mais ne fait **aucun scan côté client pour détecter les restaurants inconnus sur tout le fichier**. Seul l'échantillon envoyé au serveur est analysé.

Pour les 68 280 "À mettre à jour" : c'est normal — tu as déjà importé ce fichier, donc les commandes existantes seront mises à jour (upsert).

## Correction proposée

**Fichier : `src/pages/ReportImport.tsx`** (validation des gros fichiers, ~lignes 930-995)

Ajouter un **scan côté client** qui parcourt toutes les lignes du fichier pour extraire les noms/IDs de restaurants uniques, puis les compare à la liste des restaurants accessibles. Les non-reconnus sont injectés dans `validationResult.validation.unknownStoreIds` avant l'affichage.

### Étapes techniques

1. Après l'échantillonnage (ligne 943), scanner **toutes** les lignes pour collecter les identifiants restaurants uniques :
   - Trouver la colonne "Nom du restaurant" et "Id. du restaurant" dans le header
   - Parcourir toutes les `dataRecords` pour extraire les valeurs uniques (Set)

2. Comparer ces identifiants avec les restaurants connus :
   - Récupérer la liste depuis `allRestaurants` (déjà disponible) + `restaurant_uber_ids` + `restaurant_name_aliases`
   - Les identifiants non trouvés sont des `unknownStoreIds`

3. Injecter les résultats dans `validationResult` après le retour du dryRun :
   - Fusionner les unknown du scan client avec ceux du serveur
   - Recalculer `stats.skipped` = nombre de lignes totales contenant ces identifiants inconnus

### Détail de l'implémentation

- Le scan client est rapide (juste lire 2 colonnes de strings, pas de parsing complexe)
- On ne renvoie pas plus de données au serveur — on fait le matching côté client
- Le scan se fait en parallèle de l'appel dryRun pour ne pas ralentir

## Résultat attendu

- L'alerte rouge "Chicken Street - Lens" apparaîtra **même sur les gros fichiers** à l'étape Validation
- Le compteur "À ignorer" affichera le vrai nombre (~23 292 pour les commandes de Lens)
- L'import sera bloqué tant que le mapping n'est pas fait

