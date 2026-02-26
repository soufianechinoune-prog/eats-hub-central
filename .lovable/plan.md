

# Ameliorations visuelles de la page Eco-Contribution

## Problemes actuels identifies

En regardant la capture d'ecran et le code, plusieurs points rendent la page difficile a lire :

1. **Le chart est visuellement ecrasant** : les barres vertes et rouges cote a cote sont difficiles a comparer, et le chart prend beaucoup de place sans ajouter une ligne "Solde Net" qui est l'information cle.
2. **Les KPI cards sont toutes identiques** : meme taille, meme style, pas de hierarchie visuelle. Le "Solde Net" (info principale) n'est pas mis en avant.
3. **Le tableau par restaurant est dense** : 92 lignes sans pagination, pas de barre de progression visuelle pour voir rapidement la repartition remboursement/prelevement.
4. **Pas de contexte rapide** : on ne voit pas immediatement quel % du total un restaurant represente.

## Ameliorations proposees

### 1. KPI Cards -- Hierarchie visuelle avec Solde Net mis en avant

Transformer le Solde Net en carte principale (plus grande, avec un fond colore subtil vert/rouge selon le signe), et regrouper Remboursements + Prelevements en cartes secondaires plus compactes. Ajouter un ratio "Remb. / Prel." en pourcentage.

```text
 ┌──────────────────────────┐  ┌────────────┐ ┌────────────┐ ┌────────────┐
 │  SOLDE NET               │  │ Remb.      │ │ Prel.      │ │ 318 lignes │
 │  -11 811,82 €            │  │ 3 050,56 € │ │ 14 862 €   │ │            │
 │  ████████░░  17% recupere│  │ ↗ +12%     │ │ ↗ +8%      │ │            │
 └──────────────────────────┘  └────────────┘ └────────────┘ └────────────┘
```

- La carte Solde Net occupe `col-span-2` sur desktop
- Un mini progress bar montre le ratio remboursements/prelevements (ici 17%)
- Les 3 autres cartes restent sur 1 colonne chacune

### 2. Chart -- Remplacer barres cote-a-cote par un chart empile avec ligne Solde

Transformer le BarChart en stacked bar (Remboursements en vert, Prelevements en rouge empiles), et ajouter une `Line` pour le Solde Net mensuel. Cela permet de voir d'un coup d'oeil la balance de chaque mois.

Alternativement, un "waterfall chart" style : barres nettes par mois, colorees vert si positif, rouge si negatif. C'est plus lisible quand on veut voir l'evolution du solde.

### 3. Tableau restaurants -- Barre de progression inline + pagination

Pour chaque restaurant, ajouter une mini barre horizontale dans la colonne "Solde" qui montre visuellement la proportion remb/prel (vert a gauche, rouge a droite). Cela permet de scanner rapidement les 92 restaurants sans lire chaque chiffre.

Ajouter une limite de 20 restaurants affiches avec un bouton "Voir tout" pour ne pas surcharger la page.

### 4. Ajouter un "Top/Flop" rapide

Au-dessus du tableau, ajouter 2 mini-listes cote a cote :
- **Top 3 Solde +** : restaurants avec le meilleur solde net (vert)
- **Top 3 Solde -** : restaurants avec le pire solde net (rouge)

Cela donne un resume instantane sans parcourir tout le tableau.

## Fichiers modifies

- `src/components/analytics/EcoContributionSection.tsx` : refonte des KPI cards (hierarchie visuelle), modification du chart (stacked + ligne solde), ajout du Top/Flop, mini progress bars dans le tableau, limite d'affichage avec "Voir tout"

Aucune modification de base de donnees requise. Aucun nouveau composant -- tout est dans le fichier existant.

