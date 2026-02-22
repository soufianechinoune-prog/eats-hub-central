

## Correction du filtre "Hors 100%"

### Probleme

Le filtre utilise la valeur brute (`availabilityRate < 100`) alors que l'affichage arrondit a une decimale (`.toFixed(1)`). Resultat : un restaurant a 99.96% s'affiche comme "100.0%" mais passe quand meme le filtre car 99.96 < 100.

Meaux, Melun et Montigny sont dans ce cas -- ils ont quelques minutes hors ligne mais un taux arrondi a 100.0%.

### Solution

Remplacer le filtre brut par un filtre sur la valeur **arrondie**, coherent avec l'affichage :

```text
// Avant
s.availabilityRate < 100

// Apres  
Math.round(s.availabilityRate * 10) / 10 < 100
```

Cela s'applique a **deux endroits** dans `src/pages/DowntimeComparison.tsx` :
1. Le calcul de `imperfectCount` (ligne ~319)
2. Le filtre dans `handleExport` (ligne ~323)

### Fichier concerne

| Fichier | Modification |
|---------|-------------|
| `src/pages/DowntimeComparison.tsx` | Remplacer `s.availabilityRate < 100` par `Math.round(s.availabilityRate * 10) / 10 < 100` aux deux endroits |

Aucun autre fichier n'est impacte.
