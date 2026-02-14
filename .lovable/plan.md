
# Simplifier le classement Uber One : liste epuree + panneau lateral

## Objectif

Remplacer le tableau dense actuel (7 colonnes) par une liste epuree affichant uniquement le nom du restaurant, le pourcentage et une barre de progression. Un clic sur une ligne ouvre un panneau lateral (Sheet) avec tous les details.

## Modifications

### Fichier : `src/components/analytics/UberOneAnalysis.tsx`

**1. Liste simplifiee (lignes 509-603)**

Remplacer le tableau multi-colonnes par une liste ou chaque ligne contient :
- Nom du restaurant (avec tooltip si tronque)
- Barre de progression (% Uber One)
- Pourcentage affiche

Le tri reste fonctionnel (par nom ou par %) via les boutons d'en-tete.

**2. Panneau lateral (Sheet)**

Ajouter un state `selectedRestaurant` et un composant `Sheet` (deja disponible dans le projet) qui s'ouvre au clic sur une ligne. Le panneau affichera :
- Nom complet du restaurant
- Badge de significativite si < 10 commandes
- Section "Volume" : Commandes Uber One, Standard, Total
- Section "Panier moyen" : Uber One vs Standard avec difference en %
- Section "CA" : estimation CA Uber One et Standard (panier x volume)
- Barre visuelle du % Uber One (plus grande, plus lisible)

**3. Imports a ajouter**

- `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` depuis `@/components/ui/sheet`

### Resultat visuel

```text
Classement par restaurant
+-----------------------------------------+
| Restaurant          % Uber One          |
|-----------------------------------------|
| CS CERGY        [========    ] 66.0%    |
| CS NANTES       [=======     ] 65.2%    |
| CS LYON         [=======     ] 64.8%    |
| ...                                     |
+-----------------------------------------+

  Clic sur CS CERGY ->
  
  +------ Sheet lateral ------+
  | CS - CERGY                |
  |                           |
  | % Uber One     66.0%      |
  | [================    ]    |
  |                           |
  | Volume                    |
  | Uber One    4 139         |
  | Standard    2 133         |
  | Total       6 272         |
  |                           |
  | Panier moyen              |
  | Uber One    24.59 EUR     |
  | Standard    24.51 EUR     |
  | Diff.       +0.3%         |
  +---------------------------+
```

Aucune modification de base de donnees necessaire. Seul le fichier `UberOneAnalysis.tsx` sera modifie.
