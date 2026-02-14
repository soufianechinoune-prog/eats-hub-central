
## Correction du gras dans l'export PDF des restaurants

### Probleme identifie

Dans `drawHeader()`, la police est mise en **bold** pour les en-tetes du tableau. Apres le premier appel (page 1), le code remet bien la police en "normal" (ligne 112). Mais quand une nouvelle page est creee dans la boucle (ligne 118), `drawHeader()` remet la police en bold et il n'y a pas de `setFont("normal")` apres -- donc toutes les lignes de donnees de la premiere page sont en normal, mais celles des pages suivantes restent en bold.

### Correction

Fichier : `src/hooks/useRestaurantsExport.ts`

Ajouter `doc.setFont("helvetica", "normal")` a la fin de la fonction `drawHeader()`, juste apres la boucle des en-tetes. Ainsi, peu importe quand `drawHeader()` est appelee, la police revient automatiquement en normal pour les lignes de donnees qui suivent.

### Detail technique

```text
drawHeader()
  ├── setFont("bold")     ← pour les titres de colonnes
  ├── dessine les en-tetes
  └── setFont("normal")   ← AJOUT : reset automatique
```

Cela supprime aussi le `setFont("normal")` redondant apres le premier appel (ligne 112), pour garder le code propre.
