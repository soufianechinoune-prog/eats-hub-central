

## Restreindre le bouton "Pris en compte" aux alertes critiques uniquement

### Problème actuel
Le bouton "Pris en compte" apparaît sur **toutes** les annonces (modifications, dépôt de comptes, etc.) alors que seules les alertes critiques (`procedure_collective`, `radiation`) déclenchent l'icône ⚠️. Les annonces informatives n'ont pas besoin d'être acquittées.

### Changements

**1. `BodaccDetailSheet.tsx`** — Restreindre + rendre le bouton plus visible

- Le bouton "Pris en compte" / "Rétablir" n'apparaît **que** sur les annonces de type `procedure_collective` ou `radiation`
- Remplacer le `variant="ghost"` par un bouton plus visible : fond coloré, taille plus grande
  - Non acquitté : bouton avec fond `bg-emerald-500 text-white hover:bg-emerald-600`, taille `h-8`, texte lisible
  - Acquitté : bouton outline discret pour "Rétablir"
- La bannière rouge en haut ne s'affiche que si des alertes critiques **non acquittées** existent (déjà le cas)

**2. `BodaccAlerts.tsx`** — Même restriction

- Le bouton "Pris en compte" n'apparaît que sur les types critiques
- Même amélioration visuelle du bouton

### Résultat
- Les "Modification" et "Dépôt des comptes" n'ont plus de bouton d'acquittement
- Quand toutes les alertes critiques sont validées, l'icône ⚠️ disparaît de la liste (logique déjà en place dans `Restaurants.tsx`)
- Le bouton est bien plus visible avec un fond vert et une taille correcte

