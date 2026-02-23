

## Ameliorer le design des KPI cards du PDF Downtime

### Probleme

Les 4 KPI cards en haut du PDF sont des blocs de couleur pleine (vert ou rouge), ce qui donne un rendu "trop vert" et moins lisible. La plateforme web utilise un design plus elegant : fond blanc/clair, texte colore, sous-titre descriptif, bordure subtile.

### Solution

Redessiner les KPI cards pour reproduire le style de la plateforme :

- **Fond blanc** avec bordure gris clair (au lieu de fond colore plein)
- **Label** en gris fonce en haut
- **Valeur** en couleur (vert/rouge/orange) selon le statut
- **Sous-titre** descriptif en petit gris ("Moyenne sur la periode", "Temps de fonctionnement", "Temps d'indisponibilite", "Periodes hors ligne significatives")
- Cards plus hautes (28mm au lieu de 22mm) pour accommoder les 3 lignes de texte

### Modifications

#### `src/hooks/useReportPdfExport.ts`

Remplacer le bloc de dessin des KPI cards (lignes 261-297) :

1. Ajouter un champ `subtitle` a chaque card :
   - "Moyenne sur la periode"
   - "Temps de fonctionnement"
   - "Temps d'indisponibilite"
   - "Periodes hors ligne significatives"

2. Nouveau rendu de chaque card :
   - `doc.setFillColor(255, 255, 255)` -- fond blanc
   - `doc.roundedRect(...)` avec `"FD"` (fill + draw) et bordure gris clair `setDrawColor(229, 231, 235)`
   - Label en haut : `setTextColor(75, 85, 99)`, taille 7, normal
   - Valeur au milieu : couleur selon statut (vert `[16,185,129]` / rouge `[239,68,68]` / orange `[245,158,11]`), taille 14, bold
   - Sous-titre en bas : `setTextColor(156, 163, 175)`, taille 6, normal

### Resultat attendu

Les KPI cards ressembleront au design de la plateforme : fond blanc propre, valeurs colorees selon le statut, sous-titres explicatifs. Plus de blocs verts/rouges massifs.

### Fichiers concernes

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useReportPdfExport.ts` | Redesign des KPI cards : fond blanc, texte colore, sous-titres |

