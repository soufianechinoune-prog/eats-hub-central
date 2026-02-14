

# Corriger les noms de restaurants coupes aux limites de page

## Probleme

Le decoupage du canvas se fait a des positions en pixels arbitraires, calculees uniquement a partir de la hauteur disponible par page. Quand une ligne de restaurant tombe pile sur la frontiere, le texte est coupe en deux entre les pages.

## Solution

Ajouter une logique de "snap" qui ajuste la position de coupe pour eviter de couper du texte. Avant de trancher le canvas a une position donnee, on scanne les pixels autour de cette position pour trouver la ligne horizontale la plus "blanche" (espace entre deux lignes de restaurant), et on deplace la coupe a cet endroit.

### Fichier modifie : `src/hooks/useAnalyticsPdfExport.ts`

#### Ajouter une fonction `findSafeCutPosition`
- Prend en entree : le canvas source, la position Y cible en pixels, et une zone de recherche (ex: 80px au-dessus et en dessous)
- Pour chaque ligne Y dans cette zone, calcule la luminosite moyenne des pixels sur toute la largeur
- Retourne la position Y dont la ligne est la plus claire (la plus proche du blanc = espace entre deux elements)
- Si aucune ligne suffisamment blanche n'est trouvee, retourne la position originale

#### Modifier la boucle de pagination
- Avant de calculer `sliceHeightPx`, appeler `findSafeCutPosition` pour ajuster la position de coupe
- La tranche sera legerement plus courte ou plus longue que prevu, mais ne coupera jamais un texte

```text
Position cible (calcul brut)
     |
     v
  ~~~~ texte coupe ~~~~    <-- probleme actuel
     
Apres snap :
     |
     v    (deplace vers le gap le plus proche)
  _____ espace blanc _____  <-- coupe propre
```

#### Recalculer le nombre de pages dynamiquement
- Comme chaque coupe est ajustee, le nombre total de pages peut varier
- Passer a une boucle `while (canvasYPx < canvas.height)` au lieu d'un `for` avec `totalPages` fixe
- Calculer `totalPages` a la fin pour le footer, ou utiliser un systeme a 2 passes (1ere passe : calculer les positions de coupe, 2eme passe : generer les pages)

