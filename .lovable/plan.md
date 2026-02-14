
# Corriger le PDF Analytics : portrait, multi-pages et taille optimisee

## Problemes identifies

1. **Orientation paysage** : le PDF est en `landscape` alors que le contenu (classement vertical de 90+ restaurants) est en portrait
2. **Taille ~100 Mo** : `html2canvas` capture a `scale: 2` et encode en PNG base64, ce qui genere une image enorme embarquee telle quelle
3. **Page unique** : tout le contenu est ecrase sur une seule page au lieu d'etre pagine

## Solution

Modifier `src/hooks/useAnalyticsPdfExport.ts` avec les changements suivants :

### 1. Passer en portrait
- Changer `orientation: "landscape"` en `orientation: "portrait"`

### 2. Reduire la taille du fichier
- Baisser `scale` de 2 a 1.5 (suffisant pour la lisibilite)
- Utiliser `canvas.toDataURL("image/jpeg", 0.75)` au lieu de PNG (compression JPEG avec qualite 75%)
- Ajouter l'image avec le format `"JPEG"` au lieu de `"PNG"`

### 3. Ajouter la pagination multi-pages
- Calculer la hauteur totale de l'image par rapport a la zone imprimable
- Decouper l'image en tranches (une par page) avec `addPage()` entre chaque
- Ajouter un footer avec le numero de page sur chaque page

### Detail technique

```text
Avant :
  - orientation: landscape
  - scale: 2, format PNG
  - 1 seule page, image ecrasee

Apres :
  - orientation: portrait
  - scale: 1.5, format JPEG 75%
  - N pages, image decoupee en tranches verticales
  - Footer "Page X/N" sur chaque page
```

### Fichier modifie
- `src/hooks/useAnalyticsPdfExport.ts` (refonte complete de la fonction `exportToPdf`)
