## Objectif
Sur la page **Vue d'ensemble**, remplacer la métrique « Temps inactivité » affichée en `Xh Ymin` (somme des heures hors ligne du réseau, peu parlante) par un **% de disponibilité moyen**, plus immédiatement lisible.

## Calcul retenu
**Moyenne simple** des taux de disponibilité par restaurant :

```
dispoResto_i = total_online_minutes_i / (total_online_minutes_i + total_offline_minutes_i) × 100
dispoRéseau   = moyenne(dispoResto_i) sur les restos ayant des données
```

Restaurants sans données d'historique disponibilité → exclus de la moyenne (comme aujourd'hui).

## Changements

### 1. `src/hooks/useOverviewData.ts`
- Dans le bloc qui agrège `availabilityData` (~ligne 466-471), calculer un **`availabilityRate`** par restaurant puis faire la moyenne simple → exposer `availabilityRate: number | null` (en %, 1 décimale) au lieu de `downtimeHours`.
- Renommer le champ exposé dans `global` / `uber` (et `deliveroo` → reste `null`, comme aujourd'hui) : `downtime` devient `availabilityRate`.
- Mettre à jour le type `NetworkOverviewData` (lignes 352/361/369).

### 2. `src/pages/Overview.tsx`
- Remplacer les 3 `MetricRow` "Temps inactivité" (lignes 630, 672, 714) par :
  ```tsx
  <MetricRow
    icon={PauseCircle}
    label="Disponibilité"
    value={networkData?.global.availabilityRate != null
      ? networkData.global.availabilityRate.toFixed(1)
      : null}
    unit="%"
    color={/* vert si ≥99, ambre si ≥97, orange sinon */}
    onClick={navigateToDowntimeComparison}
  />
  ```
- Adapter les 3 mapping `downtime: networkData?.X.downtime` (lignes 447/455/463 et 482/490/498) qui alimentent `useOverviewExport` → renommer en `availabilityRate` et propager côté export.

### 3. `src/hooks/useOverviewExport.ts`
- Adapter la ligne PDF/Excel "Temps inactivité" pour afficher "Disponibilité" en %.

## Hors scope
- La page **Comparaison Temps d'inactivité** (`/compare/downtime`) garde ses heures détaillées + barres — c'est là qu'on veut le détail.
- `useNetworkStats` (`stats[].downtime`) reste inchangé : utilisé ailleurs (tableau de comparaison).

## Couleur du seuil
- `≥ 99 %` → `text-emerald-500`
- `≥ 97 %` → `text-amber-500`
- `< 97 %` → `text-orange-500`