
# Plan : Corrections PDF Export Notes Réseau

## Problèmes identifiés

### 1. Lettre "P" parasite
- **Cause** : L'emoji ⭐ passé en paramètre `subtext` n'est pas supporté par la police Helvetica de jsPDF
- **Ligne concernée** : `useRatingsExport.ts` ligne 128
```typescript
drawKPICard(..., "⭐"); // ← emoji non supporté
```

### 2. Affichage "9 / 4 1 0" au lieu de "9 410"
- **Cause** : `toLocaleString("fr-FR")` génère des espaces insécables Unicode (`\u00A0`) que jsPDF affiche de manière incorrecte
- **Vérification base** : Janvier 2026 contient bien **9 410 avis** (donc les données sont correctes)
- Le problème est purement cosmétique dans le rendu PDF

## Solution proposée

### Modifier `useRatingsExport.ts`

1. **Supprimer l'emoji étoile** du premier KPI card (ou le remplacer par "/5" qui est déjà affiché)

2. **Créer une fonction helper** pour formater les nombres sans espaces insécables :
```typescript
const formatNumber = (num: number): string => {
  return num.toLocaleString("fr-FR").replace(/\u00A0/g, " ");
};
```

3. **Appliquer ce format** à tous les appels `toLocaleString` du hook

## Fichier à modifier

| Fichier | Modification |
|---------|--------------|
| `src/hooks/useRatingsExport.ts` | Ajouter helper + supprimer emoji + remplacer tous les `toLocaleString` |

## Détail technique

Corrections à apporter :

Ligne 128 - Supprimer le subtext emoji :
```typescript
// Avant
drawKPICard(margin, yPos, "Note moyenne globale", `${data.globalStats.avgRating.toFixed(2)} / 5`, "⭐");
// Après
drawKPICard(margin, yPos, "Note moyenne globale", `${data.globalStats.avgRating.toFixed(2)} / 5`);
```

Ligne 129 et suivantes - Utiliser formatNumber :
```typescript
// Avant
data.globalStats.totalReviews.toLocaleString("fr-FR")
// Après  
formatNumber(data.globalStats.totalReviews)
```

Appliquer également aux lignes 134, 138, 177, 213 où `toLocaleString("fr-FR")` est utilisé.
