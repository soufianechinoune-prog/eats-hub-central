

## Ajouter des graphiques en barres dans le PDF d'inactivite

### Ce que tu veux
Au lieu du simple tableau de detail journalier actuel, chaque page restaurant du PDF contiendra :
1. Un **graphique en barres journalier** (comme ton premier screenshot) : une barre par jour avec le % de disponibilite, coloree en vert (>=95%) ou rouge (<95%)
2. Pour chaque jour, un **graphique en barres horaire** (comme ton deuxieme screenshot) : 24 barres montrant le % de disponibilite par heure, colorees vert/rouge

### Structure du PDF par restaurant

```text
Page restaurant :
+------------------------------------------+
| [Header vert] Restaurant - Dispo XX%     |
|                                          |
| "Disponibilite journaliere"              |
| [Barres verticales : 1 par jour]         |
|  16   17   18   19   20   21             |
| 92%  98%  87%  76%  76% 100%            |
|                                          |
| "Detail horaire - Lundi 16/02"           |
| [24 barres : 0h a 23h]                  |
|                                          |
| "Detail horaire - Mardi 17/02"           |
| [24 barres : 0h a 23h]                  |
| ...                                      |
+------------------------------------------+
```

Si la periode depasse 7 jours, les barres journalieres seront plus fines mais resteront lisibles (jusqu'a ~30 jours). Au-dela de 30 jours, les barres horaires par jour ne seront pas incluses (seulement le graphique journalier + le tableau existant).

### Enrichissement des donnees

Le `RestaurantStat` actuel ne stocke que les minutes offline par jour. Pour afficher des % en barres, il faut aussi connaitre les minutes **en ligne** par jour et par heure.

Nouvelles donnees a ajouter a l'interface :
- `dailyAvailability: Record<string, { online: number; offline: number; rate: number }>`
- `hourlyByDay: Record<string, Record<number, { online: number; offline: number; rate: number }>>`

### Rendu des barres dans jsPDF

Les barres seront dessinees directement avec `doc.rect()` (rectangles colores) -- pas besoin de capturer du HTML. Chaque barre :
- Hauteur proportionnelle au % (ex: 50mm max pour 100%)
- Verte si rate >= 95%, rouge sinon
- Label du % au-dessus de la barre
- Label du jour/heure en dessous

### Modifications de code

| Fichier | Modification |
|---------|-------------|
| `src/pages/DowntimeComparison.tsx` | Enrichir `restaurantStats` avec `dailyAvailability` et `hourlyByDay` calcules depuis `availabilityData` |
| `src/hooks/useDowntimeExport.ts` | Mettre a jour `RestaurantStat` + remplacer le tableau de detail par des graphiques en barres (journalier + horaire par jour) dessines avec `doc.rect()` |

### Limite de pages

- Periode <= 14 jours : graphique journalier + detail horaire par jour (1-2 pages par restaurant)
- Periode > 14 jours : graphique journalier uniquement + tableau existant (pas de detail horaire pour eviter un PDF trop long)

