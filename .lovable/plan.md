## Problème

Quand on sélectionne **2026** (année en cours) :
- Période courante : 1er jan → 31 déc 2026, mais on n'a des données que jusqu'à aujourd'hui (~115 jours).
- Période précédente comparée : **toute l'année 2025 entière** (365 jours).
- Résultat : la variation `-71.5 %` n'a aucun sens, on compare 4 mois vs 12 mois.

Le même biais touche deux comparatifs :
1. **Caisse Splash360 « vs période préc. »** (bandeau du bloc Répartition du CA réseau)
2. **CA / Commandes « N-1 »** (toggle "Afficher N-1" du tableau Comparatif des restaurants)

## Solution

Quand la période sélectionnée s'étend au-delà d'aujourd'hui (typiquement année en cours, mois en cours), **borner `endDate` à aujourd'hui** avant tout calcul, puis baser la période de comparaison sur cette durée réelle.

### Règles précises

- Si `endDate > aujourd'hui` → `endDate = aujourd'hui`
- Période précédente :
  - **Comparaison "période préc."** (caisse) : mêmes nb de jours, juste avant `startDate` *(déjà fait)*. Bornée naturellement.
  - **Comparaison N-1** : on décale `startDate` et `endDate` (déjà bornée) d'exactement 1 an en arrière. Donc pour 2026 année en cours, on compare **1 jan → aujourd'hui 2026** vs **1 jan → même jour 2025**. ✅

## Changements techniques

**`src/pages/Overview.tsx`** (fonction `getDateRangeFromPeriod`) :
- Après avoir calculé `start` / `end`, ajouter un clamp : `if (end > now) end = now;` pour les modes `year` et `custom_month` (et défensif sur `custom_range`).
- Cela propagera automatiquement la bonne `endDate` à `useOverviewData`, `useNetworkStats` (qui calcule N-1 en `endDate - 1 an`), et `useNetworkCashRevenue`.

**`src/components/overview/PlatformRevenueSplit.tsx`** :
- Dans la ligne info, remplacer `90j de données` par un libellé explicite : `Comparé à la même durée juste avant (X jours)` pour lever toute ambiguïté.
- Ajouter un mini libellé sous "vs période préc." du type `(1 jan – 25 avr 2026 vs 1 jan – 25 avr 2025)` *(facultatif, à confirmer)*.

**Tableau Comparatif des restaurants (toggle "Afficher N-1")** :
- Aucun changement de code nécessaire : `useNetworkStats` calcule déjà `prevStartDate = startDate - 1 an` et `prevEndDate = endDate - 1 an`. Une fois `endDate` bornée à aujourd'hui en amont, la comparaison devient automatiquement équitable (4 mois 2026 vs 4 mois 2025).

## Résultat attendu

Sur sélection "2026" au 25 avril :
- KPIs et CA = 1 jan → 25 avr 2026.
- Comparatif Caisse "vs période préc." = vs sept→déc 2025 (même durée juste avant). 
- Toggle N-1 = vs 1 jan → 25 avr 2025. Comparatif équitable. ✅

## Question optionnelle

Pour la comparaison Caisse, deux interprétations possibles de "période précédente" :
- **(A) Même durée juste avant** *(comportement actuel)* : 1 jan → 25 avr 2026 vs ~7 sept → 31 déc 2025.
- **(B) Même période N-1** : 1 jan → 25 avr 2026 vs 1 jan → 25 avr 2025. Plus cohérent avec le toggle "Afficher N-1" et plus pertinent métier (saisonnalité).

Je recommande **(B)** pour l'aligner sur le toggle N-1. À confirmer avant implémentation.