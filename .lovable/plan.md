
# Aligner les barres de progression du classement Uber One

## Probleme

Les noms de restaurants ont des longueurs variables (ex: "CS - DIJON" vs "CS - VILLEFRANCHE-SUR-SAONE"), ce qui decale le debut des barres de progression. Le `min-w-[140px]` actuel ne suffit pas pour les noms longs.

## Solution

Remplacer `min-w-[140px]` par une largeur fixe `w-[200px]` et ajouter `shrink-0` sur le conteneur du nom, pour que tous les noms occupent exactement le meme espace. Les noms trop longs seront tronques avec `truncate` (deja en place).

## Modification

### Fichier : `src/components/analytics/UberOneAnalysis.tsx` (ligne 540)

Changer la classe du `span` contenant le nom du restaurant :
- Avant : `min-w-[140px] truncate`
- Apres : `w-[200px] shrink-0 truncate`

Cela garantit que toutes les barres de progression commencent exactement au meme endroit, independamment de la longueur du nom.
