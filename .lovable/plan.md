
Objectif

- En vue annuelle, ne plus afficher les mois futurs vides.
- Le graphique doit s’arrêter à la dernière date réellement disponible dans les données importées pour la sélection active.

Plan de correction

1. `src/components/analytics/PrepTimeAnalytics.tsx`
- Calculer une `lastAvailableDate` à partir de `dailyRows` (max de `day`) après filtres restaurant / plateforme / période.
- En mode année, ne plus générer 12 mois fixes jusqu’en décembre.
- Générer uniquement les points du graphique entre le 1er janvier et le mois contenant `lastAvailableDate`.
- Conserver le drill-down actuel : en cliquant sur le dernier mois partiel, la vue mensuelle continuera naturellement jusqu’au dernier jour importé.

2. Navigation
- Empêcher la navigation “suivant” vers un mois ou un jour postérieur à la dernière date disponible.
- Garder la navigation arrière inchangée.

3. Cohérence sur les autres onglets Opérations
- Appliquer le même correctif à `src/components/analytics/WaitTimeAnalytics.tsx`
- Appliquer le même correctif à `src/components/analytics/TotalDeliveryTimeAnalytics.tsx`
- Ces composants ont aujourd’hui le même pattern : année = `31/12` + tableau de 12 mois fixes.

Détails techniques

- Cause actuelle :
  - `PrepTimeAnalytics.tsx` fixe la vue année au `31/12`
  - `monthlyEvolution` construit toujours `Array.from({ length: 12 })`
  - Résultat : l’axe affiche mai → décembre même sans données
- Correction :
  - Ajouter une borne d’affichage basée sur la dernière date présente dans les résultats déjà chargés
  - Tronquer uniquement l’affichage, sans changer les RPC ni la base
  - Si aucune donnée n’existe, conserver l’état vide actuel

Résultat attendu

- Si les imports vont jusqu’au 11/04, la vue annuelle s’arrête à avril
- Plus de mois futurs vides sur le graphique
- Le détail mensuel s’arrête bien au dernier jour importé
- Même comportement sur Prépa initial, Attente coursier et Temps de prépa total
