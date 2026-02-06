
# Plan : Corriger l'import des fichiers d'avis Uber Eats

## Diagnostic du problème

Le fichier `restaurant_rating_local.csv` contient la colonne "Valeur de la note" mais la détection automatique cherche uniquement "Note du restaurant". Résultat : le fichier est incorrectement détecté comme "Historique des commandes" car il contient "Id. de la commande" et "Heure de la commande".

Les 9369 avis ont été insérés dans `order_history` au lieu de `customer_reviews`.

## Solution en 2 étapes

### Etape 1 : Corriger la détection automatique

**Fichier** : `src/pages/ReportImport.tsx`

Ajouter "Valeur de la note" dans la détection des avis (fonction `detectReportType` et `parsePreview`).

Modifications :
1. Ligne ~428 : Ajouter la condition `headerLine.includes("Valeur de la note")` au pattern de détection `reviews_order`
2. Ligne ~550 : Ajouter la même condition pour la détection des en-têtes de prévisualisation

Cela permettra aux futurs fichiers d'avis avec "Valeur de la note" d'être correctement routés vers le parser `parse-reviews-order`.

### Etape 2 : Ré-importer le fichier

Après la correction, tu pourras ré-importer le même fichier CSV et il sera correctement détecté comme "Avis par commande".

## Section technique

```text
+--------------------------------------------------+
|  Logique de détection actuelle                   |
+--------------------------------------------------+
|  reviews_order = "Note du restaurant" +          |
|                  "UUID de la commande"           |
+--------------------------------------------------+
|  order_history = "Id. de la commande" +          |
|                  "Heure de la commande"          |
+--------------------------------------------------+

Le fichier contient :
- "Valeur de la note" (non reconnu ❌)
- "UUID de la commande" ✓
- "Id. de la commande" ✓  → Match order_history!
- "Heure de la commande" ✓

Solution: Ajouter "Valeur de la note" au pattern reviews_order
          et le placer AVANT order_history dans l'ordre de détection
```

### Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `src/pages/ReportImport.tsx` | Ajouter "Valeur de la note" dans 2 emplacements |

## Nettoyage optionnel

Après le ré-import réussi, tu pourras supprimer les entrées erronées de `order_history` via l'historique des imports si nécessaire.
