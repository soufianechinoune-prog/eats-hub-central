

# Frise Temporelle des Promotions (Style Plan Marketing)

## Objectif
Créer une vue "timeline/Gantt" pour visualiser les promotions par segment d'audience et par mois, comme le plan marketing que tu as partagé.

## Aperçu de l'interface

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  [◀ 2025]  [T1] [T2] [T3] [T4]  [2026 ▶]           [Mois ▼] [Trimestre ▼]    │
├──────────────────────────────────────────────────────────────────────────────┤
│                    │ Janvier      │ Février      │ Mars         │           │
│                    │──────────────│──────────────│──────────────│           │
├────────────────────┼──────────────┼──────────────┼──────────────┼───────────┤
│ Tous clients       │ [███ Naan    │ [████████ ST │              │           │
│                    │   TENDERS]   │  VALENTIN ♡] │              │           │
├────────────────────┼──────────────┼──────────────┼──────────────┼───────────┤
│ Nouveaux clients   │              │ [███████████ -20% Menus ███████████]    │
│                    │              │                                         │
├────────────────────┼──────────────┼──────────────┼──────────────┼───────────┤
│ Uber One           │ [██ BOGO ██] │ [██ BOGO ██] │ [██ BOGO ██] │           │
│                    │              │              │              │           │
├────────────────────┼──────────────┼──────────────┼──────────────┼───────────┤
│ Clients inactifs   │              │ [███ 1+1    │              │           │
│                    │              │     Burger] │              │           │
└────────────────────┴──────────────┴──────────────┴──────────────┴───────────┘
```

## Fonctionnalités

### 1. Navigation temporelle
- Sélecteur d'année (2025, 2026...)
- Vue par mois (12 colonnes) ou par trimestre (4 colonnes)
- Boutons précédent/suivant pour changer d'année
- Boutons de raccourci trimestres (T1, T2, T3, T4) pour zoomer

### 2. Lignes par audience
Les audiences seront affichées dans cet ordre :
- **Tous les clients** (vert/bleu-gris comme dans ton image)
- **Nouveaux clients** (vert clair)
- **Uber One** (jaune/doré)
- **Clients inactifs** (orange/pêche)

### 3. Blocs d'offres
Chaque offre sera représentée par un bloc horizontal :
- Position : alignée sur la période (start_date → end_date)
- Largeur : proportionnelle à la durée
- Contenu : titre de l'offre, dates "Du X au Y"
- Couleur de bordure : selon le type (BOGO, remise %, etc.)
- Badge "planning national" si offre nationale
- Indicateur de financement Uber si applicable

### 4. Interactions
- **Survol** : tooltip avec détails complets (restaurant, dates, résultats)
- **Clic** : ouvre le formulaire de modification
- **Filtre restaurant** : afficher uniquement les promos d'un restaurant

## Modifications techniques

### Nouveau composant : `PromotionsTimeline.tsx`

```typescript
// src/components/actions/PromotionsTimeline.tsx

interface TimelineRow {
  audience: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const AUDIENCE_ROWS: TimelineRow[] = [
  { 
    audience: "Tous les clients", 
    label: "Tous clients", 
    color: "#94a3b8",       // slate-400
    bgColor: "bg-slate-100",
    borderColor: "border-slate-300"
  },
  { 
    audience: "Uniquement pour les nouveaux clients", 
    label: "Nouveaux clients", 
    color: "#86efac",       // green-300
    bgColor: "bg-green-100",
    borderColor: "border-green-300"
  },
  { 
    audience: "Réservé aux membres Uber One", 
    label: "Clients Uber One", 
    color: "#fcd34d",       // amber-300
    bgColor: "bg-amber-100",
    borderColor: "border-amber-300"
  },
  { 
    audience: "Audience personnalisée", 
    label: "Clients inactifs", 
    color: "#fdba74",       // orange-300
    bgColor: "bg-orange-100",
    borderColor: "border-orange-300"
  },
];
```

### Calcul de position des blocs

```typescript
// Calculer la position horizontale d'un bloc sur le timeline
function getBlockPosition(
  startDate: Date,
  endDate: Date | null,
  viewStart: Date, // 1er janvier de l'année
  viewEnd: Date,   // 31 décembre de l'année
  containerWidth: number
): { left: number; width: number; visible: boolean } {
  const totalDays = differenceInDays(viewEnd, viewStart);
  const blockStart = max([startDate, viewStart]);
  const blockEnd = min([endDate || startDate, viewEnd]);
  
  if (blockEnd < viewStart || blockStart > viewEnd) {
    return { left: 0, width: 0, visible: false };
  }
  
  const leftDays = differenceInDays(blockStart, viewStart);
  const durationDays = differenceInDays(blockEnd, blockStart) + 1;
  
  return {
    left: (leftDays / totalDays) * 100,
    width: Math.max((durationDays / totalDays) * 100, 2), // min 2% pour être visible
    visible: true
  };
}
```

### Intégration dans RestaurantActions.tsx

Ajouter un nouveau mode de vue "timeline" :

```typescript
// Dans RestaurantActions.tsx
const [viewMode, setViewMode] = useState<"list" | "calendar" | "timeline">("list");
```

Ajouter un bouton dans le sélecteur de vue :

```tsx
<Button
  variant={viewMode === "timeline" ? "secondary" : "ghost"}
  size="sm"
  className="h-7 text-xs gap-1"
  onClick={() => setViewMode("timeline")}
>
  <CalendarRange className="h-4 w-4" />
  Frise
</Button>
```

### Filtrage des promotions

```typescript
// Filtrer les actions pour n'afficher que les promotions
const promotionActions = useMemo(() => {
  return actions.filter(a => a.category === "promotions");
}, [actions]);

// Grouper par audience
const actionsByAudience = useMemo(() => {
  const groups: Record<string, RestaurantAction[]> = {};
  
  AUDIENCE_ROWS.forEach(row => {
    groups[row.audience] = promotionActions.filter(
      a => (a.change_context as any)?.audience === row.audience
    );
  });
  
  return groups;
}, [promotionActions]);
```

## Structure du composant

```tsx
<div className="bg-card rounded-lg border shadow-sm overflow-hidden">
  {/* En-tête avec navigation */}
  <div className="flex items-center justify-between p-4 border-b bg-muted/30">
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => setYear(y => y - 1)}>
        <ChevronLeft />
      </Button>
      <span className="font-semibold text-lg">{year}</span>
      <Button variant="ghost" size="icon" onClick={() => setYear(y => y + 1)}>
        <ChevronRight />
      </Button>
    </div>
    
    {/* Raccourcis trimestres */}
    <div className="flex gap-1">
      {["T1", "T2", "T3", "T4"].map((q, i) => (
        <Button key={q} variant="outline" size="sm" onClick={() => scrollToQuarter(i)}>
          {q}
        </Button>
      ))}
    </div>
    
    {/* Granularité */}
    <Select value={granularity} onValueChange={setGranularity}>
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="month">Par mois</SelectItem>
        <SelectItem value="quarter">Par trimestre</SelectItem>
      </SelectContent>
    </Select>
  </div>
  
  {/* Grille Timeline */}
  <div className="relative">
    {/* En-tête des mois */}
    <div className="flex border-b sticky top-0 bg-background z-10">
      <div className="w-40 flex-shrink-0 border-r p-2 font-medium text-sm">
        Audience
      </div>
      {months.map(month => (
        <div 
          key={month} 
          className="flex-1 text-center p-2 border-r text-sm font-medium"
        >
          {format(month, "MMMM", { locale: fr })}
        </div>
      ))}
    </div>
    
    {/* Lignes par audience */}
    {AUDIENCE_ROWS.map(row => (
      <div key={row.audience} className="flex border-b min-h-[80px]">
        {/* Label audience */}
        <div 
          className={cn("w-40 flex-shrink-0 border-r p-3 font-medium text-sm", row.bgColor)}
          style={{ borderLeftWidth: 4, borderLeftColor: row.color }}
        >
          {row.label}
        </div>
        
        {/* Zone des blocs */}
        <div className="flex-1 relative">
          {/* Grille des mois (lignes verticales) */}
          {months.map((_, i) => (
            <div 
              key={i}
              className="absolute top-0 bottom-0 border-r border-dashed"
              style={{ left: `${(i + 1) * (100 / 12)}%` }}
            />
          ))}
          
          {/* Blocs d'offres */}
          {actionsByAudience[row.audience]?.map(action => {
            const pos = getBlockPosition(
              parseISO(action.start_date),
              action.end_date ? parseISO(action.end_date) : null,
              startOfYear(year),
              endOfYear(year)
            );
            
            if (!pos.visible) return null;
            
            return (
              <TimelineBlock
                key={action.id}
                action={action}
                left={pos.left}
                width={pos.width}
                borderColor={row.borderColor}
                onClick={() => openEditDialog(action)}
              />
            );
          })}
        </div>
      </div>
    ))}
  </div>
</div>
```

### Composant TimelineBlock

```tsx
function TimelineBlock({ action, left, width, borderColor, onClick }) {
  const isNational = !action.restaurant_ids?.length && !action.restaurant_id;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "absolute top-2 bottom-2 rounded-md border-2 px-2 py-1",
            "cursor-pointer hover:shadow-lg transition-shadow",
            "flex flex-col justify-center text-xs",
            borderColor,
            "bg-white dark:bg-slate-800"
          )}
          style={{ left: `${left}%`, width: `${width}%` }}
          onClick={onClick}
        >
          {isNational && (
            <span className="text-[10px] text-muted-foreground absolute top-0.5 right-1">
              national
            </span>
          )}
          <span className="font-medium truncate">{action.title}</span>
          <span className="text-muted-foreground text-[10px] truncate">
            Du {format(parseISO(action.start_date), "d", { locale: fr })} au{" "}
            {format(parseISO(action.end_date || action.start_date), "d MMM", { locale: fr })}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {/* Détails complets de l'offre */}
      </TooltipContent>
    </Tooltip>
  );
}
```

## Fichiers à créer/modifier

| Fichier | Action |
|---------|--------|
| `src/components/actions/PromotionsTimeline.tsx` | **Créer** - Nouveau composant timeline |
| `src/pages/RestaurantActions.tsx` | **Modifier** - Ajouter mode "timeline" et bouton de vue |

## Améliorations futures possibles

1. **Drag & drop** pour déplacer les offres sur la timeline
2. **Mode création** : cliquer sur une cellule pour créer une nouvelle offre
3. **Export PDF** du plan marketing
4. **Comparaison N-1** : afficher les offres de l'année précédente en filigrane

