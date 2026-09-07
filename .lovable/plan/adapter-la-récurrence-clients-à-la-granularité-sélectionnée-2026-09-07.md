# Adapter la récurrence clients à la granularité sélectionnée

## Objectif
Sur la page **Croissance & Clients** (canal Chataigne), le graphique de récurrence doit suivre la même granularité que les autres graphiques (jour / semaine / mois) au lieu de rester figé sur « par semaine ». Le titre devient « Récurrence des clients ».

## Changements prévus

### 1. Supprimer la requête hebdomadaire dédiée
- Remplacer `weeklyQ` (toujours en `week`) par la réutilisation de `evolutionQ` qui est déjà paramétrée par `granularity`.
- Renommer `recurrenceWeekly` en `recurrenceData` et faire dépendre `periodLabel(..., granularity)`.

### 2. Mettre à jour le graphique de récurrence
- Titre : **Récurrence des clients**.
- Sous-titre dynamique : indiquer la période affichée (jour / semaine / mois) et conserver la formule « clients récurrents ÷ total actifs ».
- Conserver l’axe Y unique en pourcentage, le tooltip avec le détail `recurrents / actifs`, et la courbe verte existante.

### 3. Mettre à jour la tuile KPI
- Laisser le libellé « % clients récurrents ».
- Le mini sparkline doit utiliser les données de la granularité active (et donc refléter jour / semaine / mois).
- Conserver le calcul pondéré global `recurrents / actifs * 100` sur toute la période.

### 4. Vérifications
- Compilation TypeScript.
- Aperçu visuel : vérifier que le titre change et que la courbe s’adapte quand on bascule Jour / Semaine / Mois.

## Fichier concerné
- `src/pages/ChataigneGrowth.tsx`
