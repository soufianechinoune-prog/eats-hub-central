
# Afficher "CS + Ville" dans les colonnes de restaurants

## Problème
Les en-têtes de colonnes affichent actuellement le nom complet des restaurants (ex: "CHICKEN STREET ANTONY") qui est tronqué à "CHICKEN STRE..." car la colonne est trop étroite.

## Solution
Utiliser la fonction existante `extractCityName` de `src/lib/restaurantUtils.ts` et ajouter le préfixe "CS" pour obtenir un format court et lisible : **"CS Antony"**, **"CS Athis-Mons"**, etc.

## Changement à effectuer

**Fichier : `src/components/menu/ProfitabilityComparison.tsx`**

| Avant | Après |
|-------|-------|
| `CHICKEN STRE...` | `CS Antony` |
| `CHICKEN STRE...` | `CS Athis-Mons` |
| `CHICKEN STRE...` | `CS Bonneuil` |
| `CHICKEN STRE...` | `CS Juvisy` |

### Modifications techniques

1. **Importer la fonction utilitaire** :
```typescript
import { extractCityName } from "@/lib/restaurantUtils";
```

2. **Créer une fonction helper** pour le format "CS + Ville" :
```typescript
const getShortRestaurantName = (name: string): string => {
  return `CS ${extractCityName(name)}`;
};
```

3. **Modifier les 3 endroits où les noms sont affichés** :
   - En-têtes de colonnes du tableau (ligne ~442-444)
   - Export Excel - colonnes Prix (ligne ~196-198)
   - Export Excel - colonnes Marges (ligne ~199-202)

### Résultat attendu

Les colonnes afficheront :
- **CS Antony** au lieu de "CHICKEN STRE..."
- **CS Athis-Mons** au lieu de "CHICKEN STRE..."
- **CS Bonneuil** au lieu de "CHICKEN STRE..."
- **CS Juvisy** au lieu de "CHICKEN STRE..."
