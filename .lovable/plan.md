

# Analyse et ameliorations de la page Conversion

## Problemes identifies

### 1. Graphique "Taux de Conversion Global" : affichage quotidien alors que la data est hebdomadaire
La data source (`daily_conversion`) contient en realite des valeurs identiques pour tous les jours d'une meme semaine (c'est Uber qui fournit la data a la semaine). Du coup, afficher en "daily" cree des lignes plates avec des paliers — c'est trompeur. Il faut forcer la granularite par defaut a "weekly" quand on est en vue mois, et labelliser les semaines de maniere lisible (ex: "S1 Mars", "S2 Mars" ou "03/03 - 09/03").

### 2. Funnel de conversion : pas de comparaison entre semaines
Le funnel (`ConversionFunnelChart`) affiche actuellement les totaux agreges sur toute la periode selectionnee (ex: tout le mois de mars). Il n'y a aucun moyen de comparer semaine par semaine au sein d'un mois. L'utilisateur veut voir l'evolution du funnel semaine apres semaine.

## Plan de correction

### 1. Granularite par defaut en "Semaine" pour la vue mois

**`src/components/analytics/AnalyticsCharts.tsx`**
- Quand `periodMode === "month"` ou que la periode selectionnee est <= 31 jours, forcer la granularite par defaut a `"weekly"` au lieu de `"daily"` pour la section conversion.
- Modifier les labels du mode weekly : au lieu de `dd/MM` (ex: "03/03"), afficher `"S1"`, `"S2"`, `"S3"`, `"S4"` ou `"Sem. 03/03"` — format plus lisible.
- Mettre a jour le tooltip pour afficher la plage de dates de la semaine (ex: "03/03 - 09/03").

### 2. Comparaison par semaine dans le funnel

**`src/components/analytics/ConversionFunnelChart.tsx`**
- Ajouter un selecteur de semaine en haut du funnel : des pills/badges "Tout le mois", "S1 (03-09/03)", "S2 (10-16/03)", etc.
- Quand une semaine est selectionnee, le funnel n'affiche que les donnees de cette semaine.
- Quand "Tout le mois" est selectionne, comportement actuel (agrege).
- Afficher les variations par rapport a la semaine precedente (ex: "S2 vs S1 : +12% visites").
- Les semaines sont calculees dynamiquement a partir des donnees brutes `conversionData` passees au composant.

**`src/components/analytics/AnalyticsCharts.tsx`**
- Passer les donnees brutes quotidiennes (`conversionData`) au `ConversionFunnelChart` en plus des donnees agregees, pour qu'il puisse calculer les sous-totaux par semaine.

### 3. Pas de changements backend
Toutes les modifications sont purement front-end — les donnees quotidiennes sont deja disponibles.

## Resume des fichiers modifies
- `src/components/analytics/AnalyticsCharts.tsx` — granularite par defaut weekly en vue mois, passage des raw data au funnel
- `src/components/analytics/ConversionFunnelChart.tsx` — selecteur de semaine + comparaison S vs S-1

