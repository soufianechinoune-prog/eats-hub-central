
# Supprimer la pagination et ajouter le scroll infini

## Objectif
Remplacer la pagination par un scroll infini dans les 3 tables de comparaison :
- Comparaison Notes (RatingsFullRankingTable)
- Comparaison Temps de preparation (PrepTimeFullRankingTable)  
- Comparaison Temps prepa+livraison (TotalDeliveryTimeFullRankingTable)

## Principe
Comme sur la page "Temps d'inactivite" (DowntimeRankingBars), la table affichera tous les resultats dans une zone scrollable sans pagination.

## Modifications par fichier

### 1. RatingsFullRankingTable.tsx

**Suppressions :**
- Import de Pagination et ses sous-composants (lignes 17-24)
- Constante ITEMS_PER_PAGE (ligne 63)
- State currentPage et setCurrentPage (ligne 77)
- Reset de currentPage dans handleSort et handleSearch
- Calcul totalPages (ligne 148)
- Calcul paginatedData (lignes 149-152)
- Bloc JSX de pagination (lignes 303-352)

**Modifications :**
- Remplacer `paginatedData` par `filteredAndSortedData` dans le map du TableBody
- Ajouter une hauteur maximale avec scroll sur le container de la table

**Code cible :**
```tsx
<div className="rounded-lg border overflow-hidden max-h-[700px] overflow-y-auto">
  <Table>
    ...
    <TableBody>
      {filteredAndSortedData.map((restaurant) => ...)}
    </TableBody>
  </Table>
</div>
```

### 2. PrepTimeFullRankingTable.tsx

Memes modifications que RatingsFullRankingTable :
- Supprimer imports pagination
- Supprimer ITEMS_PER_PAGE, currentPage, totalPages, paginatedData
- Supprimer bloc pagination JSX
- Ajouter max-h-[700px] overflow-y-auto sur le container
- Utiliser filteredAndSortedData au lieu de paginatedData

### 3. TotalDeliveryTimeFullRankingTable.tsx

Memes modifications :
- Supprimer imports pagination
- Supprimer ITEMS_PER_PAGE, currentPage, totalPages, paginatedData
- Supprimer bloc pagination JSX
- Ajouter max-h-[700px] overflow-y-auto sur le container
- Utiliser filteredAndSortedData au lieu de paginatedData

## Resume des changements

| Element | Avant | Apres |
|---------|-------|-------|
| Navigation | Boutons Previous/Next et numeros | Scroll vertical natif |
| Affichage | 25 items par page | Tous les items visibles |
| Container | Hauteur auto | max-h-[700px] avec overflow-y-auto |
| Compteur | "Page X sur Y" | Supprime |

## Section technique

### Imports a supprimer (dans les 3 fichiers)
```tsx
// Supprimer ces lignes
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
```

### State a supprimer
```tsx
// Supprimer
const [currentPage, setCurrentPage] = useState(1);
const ITEMS_PER_PAGE = 25;
```

### Calculs a supprimer
```tsx
// Supprimer
const totalPages = Math.ceil(filteredAndSortedData.length / ITEMS_PER_PAGE);
const paginatedData = useMemo(() => {
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  return filteredAndSortedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
}, [filteredAndSortedData, currentPage]);
```

### Container avec scroll
```tsx
<div className="rounded-lg border overflow-hidden max-h-[700px] overflow-y-auto">
```

### TableBody utilisant toutes les donnees
```tsx
<TableBody>
  {filteredAndSortedData.map((restaurant) => ...)}
</TableBody>
```
