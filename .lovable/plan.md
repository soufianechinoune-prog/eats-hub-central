

# Distinguer visuellement les lignes Uber / Deliveroo dans l'éco-contribution

## Probleme

Dans la vue Global, les lignes individuelles (drilldown "Par restaurant") affichent un minuscule point coloré (1.5px) pour indiquer la plateforme. C'est quasi invisible et non identifiable sans legende.

De meme, dans la vue "Lignes individuelles" (onglet Detail), la colonne "Plateforme" avec les badges est correcte mais le drilldown du tableau "Par restaurant" (onglet Synthese) manque de clarte.

## Solution

Remplacer le petit dot par un **badge texte compact** (similaire a ceux dans `EcoContributionDetail.tsx`) directement dans les lignes du drilldown "Par restaurant".

## Modifications

### `src/components/analytics/EcoContributionSection.tsx` (lignes 452-456)

Remplacer le dot de 1.5px par un badge textuel :

```
// Avant
<span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 bg-cyan-500/bg-green-500" />

// Apres
<Badge variant="outline" className="text-[9px] h-4 px-1 mr-1.5 border-cyan-500 text-cyan-600">Deliveroo</Badge>
// ou
<Badge variant="outline" className="text-[9px] h-4 px-1 mr-1.5 border-green-500 text-green-600">Uber</Badge>
```

Concretement, dans la `MonthDrilldownRow`, quand `showPlatformDot` est true, afficher un petit badge avec le nom de la plateforme au lieu du point invisible.

### Fichiers a modifier
- `src/components/analytics/EcoContributionSection.tsx` : remplacer le dot par un Badge dans `MonthDrilldownRow` (~ligne 454-456)

