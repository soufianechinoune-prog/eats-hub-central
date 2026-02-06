
# Plan : Corriger l'affichage du sélecteur de restaurant pour les avis

## Problème identifié

Le fichier `reportImportConfig.ts` configure correctement `reviews_order` et `reviews_item` avec `requiresRestaurant: false`, mais le code dans `ReportImport.tsx` contient **4 listes hardcodées** qui incluent encore ces types comme nécessitant un restaurant.

Le parser `parse-reviews-order` est conçu pour gérer les fichiers **multi-restaurant** : il identifie automatiquement chaque restaurant via le `uber_store_id` du CSV ou par matching de nom.

## Incohérences à corriger

| Ligne | Code actuel | Correction |
|-------|-------------|------------|
| ~690 | `["sales_over_time", "marketing_campaigns", "reviews_order", "reviews_item", ...]` | Retirer `"reviews_order"` et `"reviews_item"` |
| ~728 | `["sales_over_time", "marketing_campaigns", "reviews_order", "reviews_item", ...]` | Retirer `"reviews_order"` et `"reviews_item"` |
| ~855 | `["sales_over_time", "marketing_campaigns", "reviews_order", "reviews_item", ...]` | Retirer `"reviews_order"` et `"reviews_item"` |
| ~1334 | `(reportType === "reviews_order" \|\| reportType === "reviews_item")` | Retirer ces conditions |

## Solution recommandée

Utiliser la configuration centralisée `requiresRestaurant()` de `reportImportConfig.ts` au lieu de listes hardcodées, pour éviter les divergences futures.

**Fichier à modifier** : `src/pages/ReportImport.tsx`

### Changements

1. Importer la fonction `requiresRestaurant` depuis le fichier de config
2. Remplacer les listes hardcodées par un appel à cette fonction
3. Mettre à jour la condition UI du sélecteur de restaurant

## Section technique

```text
Avant (hardcodé) :
  const requiresRestaurant = ["sales_over_time", "marketing_campaigns", "reviews_order", ...].includes(reportType);

Après (centralisé) :
  import { requiresRestaurant as checkRequiresRestaurant } from "@/lib/reportImportConfig";
  const needsRestaurant = checkRequiresRestaurant(reportType);
```

L'avantage : une seule source de vérité dans `reportImportConfig.ts`, évitant les incohérences futures.

## Résultat attendu

- Le sélecteur de restaurant n'apparaîtra plus pour les fichiers d'avis
- Le parser multi-restaurant identifiera automatiquement les restaurants via le CSV
- Les 11 restaurants épinglés pourront être importés en une seule opération
