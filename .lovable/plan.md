

# Plan : Ajouter le tri par rang au tableau de classement

## Problème identifié

Le tableau "Classement complet" sur la page `/compare/ratings` ne permet pas de trier par la colonne **#** (rang). Par défaut, le tri se fait par note décroissante, mais les rangs affichés ne correspondent pas forcément à l'ordre visuel.

## Solution

Rendre la colonne **#** cliquable pour trier par rang, et corriger la logique de tri pour ce champ.

## Modifications

### Fichier : `src/components/compare/RatingsFullRankingTable.tsx`

| Ligne | Changement |
|-------|------------|
| 75-76 | Changer le tri par défaut à `"rank"` au lieu de `"avgRating"` |
| 98 | Ajouter la logique de tri par rang dans `handleSort` |
| 113-127 | Ajouter le cas `"rank"` dans le switch de tri |
| 207 | Rendre l'en-tête **#** cliquable avec un bouton de tri |

### Code avant / après

**État initial du tri (ligne 75-76) :**
```typescript
// Avant
const [sortField, setSortField] = useState<SortField>("avgRating");
const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

// Après - tri par rang ascendant par défaut
const [sortField, setSortField] = useState<SortField>("rank");
const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
```

**Ajout du tri par rang dans le switch (ligne 113-127) :**
```typescript
// Ajouter ce cas
case "rank":
  const rankA = rankedData.get(a.id) || 999;
  const rankB = rankedData.get(b.id) || 999;
  comparison = rankA - rankB;
  break;
```

**Rendre la colonne # cliquable (ligne 207) :**
```typescript
// Avant
<TableHead className="w-16 text-center">#</TableHead>

// Après
<TableHead className="w-16 text-center">
  <button 
    className="flex items-center justify-center hover:text-foreground transition-colors mx-auto"
    onClick={() => handleSort("rank")}
  >
    #
    <SortIcon field="rank" />
  </button>
</TableHead>
```

## Résultat attendu

1. Par défaut, le tableau affiche les restaurants triés par rang (1, 2, 3...)
2. Tu peux cliquer sur **#** pour inverser l'ordre (dernier en premier)
3. Tu peux toujours trier par Restaurant, Note ou Avis
4. Le rang affiché reste cohérent avec la note moyenne globale

