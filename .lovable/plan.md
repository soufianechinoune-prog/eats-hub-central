# Plan : Période par défaut = Semaine précédente (Lundi–Dimanche)

## Problème
L'utilisateur arrive sur `/overview` (onglet Uber Eats ou Vue réseau) et voit "2026" ou une période année car le `localStorage` mémorise le dernier choix. Le besoin est de forcer la période par défaut à **"Semaine précédente"** au montage, indépendamment de l'état stocké.

## Implémentation

### 1. Forcer `previous_week` au montage (`src/pages/Overview.tsx`)
Modifier l'initialisation du `useState` pour `periodMode` : ne plus lire `storedState?.periodMode` au premier rendu, mais utiliser directement `"previous_week"`. Le `localStorage` continue de servir à mémoriser les choix manuels de l'utilisateur APRÈS interaction, mais le premier affichage sera toujours la semaine précédente.

**Détail technique :**
```
Avant : storedState?.periodMode || ctxPeriodMode || defaultPeriodMode
Après : defaultPeriodMode  // toujours "previous_week"
```
On garde `storedState` pour `selectedYear`, `selectedMonth` et `dateRange` (si l'utilisateur revient après avoir personnalisé, il ne perd pas tout), mais on ignore spécifiquement `periodMode` au boot.

### 2. Semaine Lundi–Dimanche (déjà en place)
Vérifier que le calcul de dates utilise bien `weekStartsOn: 1` (Lundi). Le code actuel le fait déjà : `startOfWeek(lastWeek, { weekStartsOn: 1 })` et `endOfWeek(lastWeek, { weekStartsOn: 1 })`. Aucun changement nécessaire.

### 3. Option : réinitialiser l'état stocké obsolète (1 ligne)
Ajouter une logique de "migration" : si `storedState.periodMode === "year"`, on le réécrit en `"previous_week"` dans le localStorage pour éviter que les utilisateurs existants ne revoient jamais 2026.

## Hors scope (validé avec l'utilisateur)
- Pas de badge "données partielles" pour le moment.
- Pas de mode live pour le moment.
- Pas de changement sur les sous-pages (Finances, Conversion, etc.).

## Fichier impacté
- `src/pages/Overview.tsx` (L95-98 et L142-153)
