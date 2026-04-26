## Objectif

Reproduire le sélecteur de semaines (« Tout le mois », « 26 janv. - 1 févr. », « 2-8 févr. », …) qui existe déjà sur le **Funnel de Conversion** et l'ajouter au-dessus du graphique **Visites vs Conversion**, pour permettre de filtrer ce graphique par semaine sans toucher au reste de la page.

Chaque graphique reste indépendant : sélectionner une semaine sur le scatter ne modifie ni le funnel, ni le ranking, ni le leaky bucket, ni les KPIs du haut. C'est cohérent avec ce qui se fait déjà côté funnel.

## Comportement attendu

- Une rangée de chips au-dessus du scatter : `Tout le mois` + une chip par semaine de la période (mois) sélectionnée.
- Chip active = surlignée violet (même style que le funnel).
- Par défaut : `Tout le mois` (comportement actuel inchangé).
- Au clic sur une semaine :
  - Les points du scatter sont recalculés à partir des données de cette semaine uniquement (visites + commandes par restaurant sur les 7 jours).
  - Le benchmark anonymisé local et la ligne de connexion se mettent à jour automatiquement (ils dépendent du restaurant sélectionné, pas de la semaine — ils continuent de fonctionner).
  - Animation déjà en place (Recharts `isAnimationActive`) → transition douce.
- Si une semaine ne contient aucune donnée pour un restaurant, il est filtré du scatter (comme aujourd'hui : `r.visits > 0`).

## Détails techniques

**Fichier principal modifié :** `src/components/analytics/ConversionScatterPlot.tsx`

1. **Nouvelle prop** : `rawConversionData?: any[]` (les données brutes journalières, déjà disponibles dans `AnalyticsCharts.tsx` sous `conversionData`).
2. **Nouveau state local** : `selectedWeek: string | null` (clé `yyyy-MM-dd` du lundi de la semaine, `null` = toute la période). Réutilise la même convention que `ConversionFunnelChart`.
3. **Calcul des semaines disponibles** (`useMemo`) : reprendre la logique exacte de `ConversionFunnelChart.tsx` (lignes ~290-329) — `startOfWeek` / `endOfWeek` avec `locale: fr`, dédupliqué via `deduplicateWeeklyConversion`. Extraire éventuellement dans un helper partagé `src/lib/weeklyBreakdown.ts` pour ne pas dupliquer.
4. **Recalcul des points du scatter** : si `selectedWeek` est défini, agréger `rawConversionData` filtré sur la semaine choisie par `restaurant_id` ; sinon utiliser la prop `data` actuelle. Ne pas casser le branchement actuel du benchmark (`selectedRestaurantId` reste indépendant).
5. **Rendu de la barre de chips** : composant inline réutilisant le style des chips du funnel (`rounded-full`, fond violet quand actif). Posé dans le `CardHeader` du scatter, sous le titre.

**Fichier secondaire :** `src/components/analytics/AnalyticsCharts.tsx`
- Passer `rawConversionData={conversionData}` au `<ConversionScatterPlot />` (ligne ~3351).

## Hors scope (volontaire)

- Pas de synchronisation avec les chips du funnel.
- Pas de modification des KPIs en haut de page.
- Pas de comparaison WoW dans le scatter (déjà couverte par le funnel).

Si tu veux plus tard une synchro globale (un seul sélecteur de semaine pour toute la page), on le fera dans une seconde itération.
