

# Bug : le scan client sur-détecte les restaurants inconnus (37 au lieu de ~1)

## Cause racine

Le scan côté client (`clientSideRestaurantScan` dans `ReportImport.tsx`) ne fait que du matching **exact par nom normalisé**. Il manque deux logiques que le serveur (`parse-payment-report`) possède :

1. **Matching partiel** (`findRestaurantByPartialName`) : le serveur extrait la ville de "Chicken Street - Besançon" et cherche si un restaurant connu contient "besancon". Le client ne fait pas ça → il flag "Chicken Street - Besançon" comme inconnu alors que "Chicken Street Besançon" existe en base.

2. **Cross-référence nom ↔ store_id** : une ligne CSV a souvent à la fois un `uber_store_id` ET un `Nom du restaurant`. Si le store_id est connu (via `restaurant_uber_ids`), le restaurant est reconnu même si le nom CSV diffère légèrement. Le client vérifie les noms et les store_ids **séparément** sans croiser les deux.

Résultat : le client rapporte 37 inconnus qui écrasent le résultat serveur (qui en trouvait peut-être ~1).

## Correction

**Fichier : `src/pages/ReportImport.tsx`** — fonction `clientSideRestaurantScan`

### 1. Ajouter le matching partiel (même logique que le serveur)

Après la vérification `knownNormalizedNames.has(normalized)`, ajouter :
- Extraire la partie ville du nom CSV (regex `Chicken\s*Street\s*[-–—]\s*(.+)`)
- Chercher si une seule entrée dans `knownNormalizedNames` contient cette ville normalisée
- Si oui → considérer comme trouvé

### 2. Croiser nom et store_id par ligne

Actuellement le scan collecte les noms et store_ids dans des Sets séparés. Il faut aussi construire un Map `nom → store_ids associés` pour que si un nom est inconnu mais que son store_id correspondant est connu, on ne le flagge pas.

Concrètement :
- Pendant le parcours des lignes, construire `nameToStoreIds: Map<string, Set<string>>`
- Lors de la vérification d'un nom inconnu, checker si au moins un store_id associé est dans `knownUberStoreIds`
- Si oui → le restaurant est en fait connu via son UUID

### 3. Éviter d'écraser les résultats serveur quand le client est moins précis

Actuellement (ligne 1199), le client **remplace** `stats.skipped` par son propre `skippedCount`. Si le serveur a déjà un meilleur résultat (moins d'inconnus grâce au matching partiel), le client ne devrait pas augmenter le nombre d'inconnus.

Logique : ne fusionner le scan client que si le serveur n'a renvoyé aucun `unknownStoreIds` (sampling raté) ou si le client trouve des inconnus supplémentaires que le serveur n'a pas vus.

## Résultat attendu

- Seul "Chicken Street - Lens" (le vrai inconnu) apparaîtra dans l'alerte rouge
- Les 36 autres restaurants seront correctement résolus par le matching partiel ou le cross-référencement store_id
- Le compteur "À ignorer" reflétera uniquement les lignes de Lens

