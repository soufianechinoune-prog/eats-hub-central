

# Masquer le contenu quand aucune donnee n'est disponible

## Probleme

Quand l'alerte "Aucune donnee disponible" s'affiche (periode entierement avant les donnees importees), les graphiques et classements apparaissent quand meme en dessous avec des valeurs fausses (100% partout, 0min d'inactivite). C'est contradictoire et trompeur.

## Solution

Quand `dataAlert === "full"`, remplacer tout le contenu (insights, classement, heatmap) par un message central expliquant l'absence de donnees. Le bandeau d'alerte orange reste en place pour le cas `"partial"` (historique limite mais donnees partielles disponibles).

## Details techniques

### Fichier : `src/pages/DowntimeComparison.tsx`

Dans le bloc conditionnel apres le loading spinner, ajouter une condition : si `dataAlert === "full"`, afficher un ecran vide centre avec une icone `AlertTriangle`, un titre et une description explicative, au lieu du grid contenant les insights, le classement et la heatmap.

Le cas `"partial"` continue d'afficher le bandeau orange en haut ET le contenu en dessous (car une partie des donnees est exploitable).

Structure du rendu :

```text
if isLoading -> spinner
else if dataAlert === "full" -> message central plein ecran (icone + texte)
else -> contenu normal (insights + classement + heatmap)
```

Le message central reprendra le texte existant de l'alerte avec un style centre et une hauteur minimale pour occuper l'espace.

