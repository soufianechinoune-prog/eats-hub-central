
# Corriger le comptage "Versements" dans le tableau par restaurant

## Probleme

La colonne "Versements" affiche le nombre total de **versements hebdomadaires** (lignes dans la table `payouts`) pour chaque restaurant. Par exemple, Toulouse affiche 540 parce qu'il y a 540 lignes de versement au total, alors que seules quelques-unes concernent l'eco-contribution. Ce chiffre n'a aucun rapport avec l'eco-contribution.

## Solution

Remplacer le comptage des versements (`r.count` issu de la requete `payouts`) par le nombre de **lignes eco-contribution** (`detailLines.length`) pour chaque restaurant. Renommer aussi l'en-tete de colonne en "Lignes" pour plus de clarte.

## Detail technique

| Fichier | Modification |
|---------|-------------|
| `src/components/analytics/EcoContributionSection.tsx` | Ligne 216 : renommer "Versements" en "Lignes" |
| `src/components/analytics/EcoContributionSection.tsx` | Dans `RestaurantDrilldown`, remplacer `r.count` par `detailLines.length` dans la derniere cellule |

### Avant

```text
<TableHead>Versements</TableHead>
...
<TableCell>{r.count}</TableCell>   <!-- compte TOUS les payouts -->
```

### Apres

```text
<TableHead>Lignes</TableHead>
...
<TableCell>{detailLines.length}</TableCell>   <!-- compte les lignes eco-contribution -->
```

## Resultat attendu

- Toulouse affichera le vrai nombre de lignes eco-contribution (environ 9) au lieu de 540
- Marseille Belsunce affichera environ 9 au lieu de 107
- L'information sera coherente avec le drill-down mensuel
