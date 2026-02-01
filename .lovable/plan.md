

# Refonte Visuelle - Style "Plan Marketing"

## Objectif
Aligner le design de la timeline sur ton image de référence avec les couleurs vives, les en-têtes en forme de flèche, et les blocs plus détaillés.

## Modifications Visuelles

### 1. En-têtes de mois (style chevron/flèche)

```text
┌─────────────────────────────────────────────────┐
│  [Janvier    ▶] [Février   ▶] [Mars      ▶]    │
│   (gris foncé, forme flèche, texte blanc)       │
└─────────────────────────────────────────────────┘
```

Utiliser un clip-path CSS pour créer la forme de flèche :
```css
clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 50%, calc(100% - 20px) 100%, 0 100%);
```

### 2. Labels d'audience (couleurs pleines)

| Audience | Couleur actuelle | Nouvelle couleur |
|----------|------------------|------------------|
| Tous clients | `bg-muted/50` | `bg-[#5B9BD5]` (bleu) |
| Nouveaux clients | `bg-emerald-100` | `bg-[#70AD47]` (vert) |
| Clients Uber One | `bg-amber-100` | `bg-[#FFC000]` (jaune/or) |
| Clients inactifs | `bg-orange-100` | `bg-[#F4B183]` (pêche) |

Texte en blanc pour meilleur contraste.

### 3. Blocs d'offres enrichis

Structure améliorée :
```text
┌─────────────────────────────────────────┐
│                      planning national  │ ← italique, petit
│         Du 09 au 16                     │ ← dates en haut
│       ST VALENTIN 💛                    │ ← titre avec emoji
│                                         │
│    1 acheté = 1 offert sur un burger    │ ← description
│                                         │
│ FINANCEMENT MOITIÉ FOOD COST...         │ ← note financement
└─────────────────────────────────────────┘
```

Afficher :
- Description de l'offre (`action.description`)
- Note de co-financement depuis `change_context.coFundingPercent` ou `change_context.coFundingNote`
- Hauteur minimum plus grande pour accommoder le contenu

### 4. Palette de couleurs mise à jour

```typescript
const AUDIENCE_ROWS: TimelineRow[] = [
  { 
    audience: "Tous les clients", 
    label: "Tous clients", 
    labelBg: "bg-[#5B9BD5]",        // Bleu comme ton image
    labelText: "text-white",
    blockBorder: "border-[#5B9BD5]"
  },
  { 
    audience: "Uniquement pour les nouveaux clients", 
    label: "Nouveaux clients", 
    labelBg: "bg-[#70AD47]",        // Vert
    labelText: "text-white",
    blockBorder: "border-[#70AD47]"
  },
  { 
    audience: "Réservé aux membres Uber One", 
    label: "Clients Uber One", 
    labelBg: "bg-[#FFC000]",        // Jaune/Or
    labelText: "text-white",
    blockBorder: "border-[#C69500]" // Bordure plus foncée
  },
  { 
    audience: "Audience personnalisée", 
    label: "Clients inactifs", 
    labelBg: "bg-[#F4B183]",        // Pêche/Saumon
    labelText: "text-white",
    blockBorder: "border-[#E07B39]"
  },
];
```

## Fichiers à modifier

| Fichier | Action |
|---------|--------|
| `src/components/actions/PromotionsTimeline.tsx` | Modifier styles et structure des blocs |

## Détails techniques

### En-tête de mois avec forme flèche

```tsx
{periods.map((period, i) => (
  <div 
    key={i} 
    className="flex-1 flex items-center justify-center text-white text-sm font-medium capitalize relative"
    style={{ 
      minWidth: selectedQuarter !== null ? "150px" : "80px",
      backgroundColor: "#6B7280", // Gris foncé
      clipPath: "polygon(0 0, calc(100% - 15px) 0, 100% 50%, calc(100% - 15px) 100%, 0 100%)",
      marginRight: "-10px",
      paddingRight: "25px",
      height: "40px"
    }}
  >
    {period.label}
  </div>
))}
```

### TimelineBlock enrichi

```tsx
function TimelineBlock({ action, ... }) {
  const coFunding = (action.change_context as any)?.coFundingPercent;
  const coFundingNote = (action.change_context as any)?.coFundingNote;
  
  return (
    <div className="... min-h-[100px]">
      {/* Planning national badge */}
      {isNational && (
        <span className="absolute top-1 right-2 text-[10px] italic text-muted-foreground">
          planning national
        </span>
      )}
      
      {/* Dates en haut */}
      <span className="text-[11px] text-center">
        Du {format(startDate, "dd")} au {format(endDate, "dd")}
      </span>
      
      {/* Titre avec emoji potentiel */}
      <span className="font-bold text-sm text-center">{action.title}</span>
      
      {/* Description de l'offre */}
      {action.description && (
        <span className="text-xs text-center mt-1">{action.description}</span>
      )}
      
      {/* Note de co-financement */}
      {(coFunding || coFundingNote) && (
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground italic mt-auto">
          {coFundingNote || `FINANCEMENT ${coFunding}% UBER EATS`}
        </span>
      )}
    </div>
  );
}
```

### Hauteur des lignes ajustée

```tsx
<div className="flex border-b min-h-[120px]">
  {/* Augmenter la hauteur minimum pour accommoder le contenu */}
</div>
```

## Résultat attendu

La timeline aura exactement le même style que ton image PowerPoint :
- En-têtes de mois gris foncé en forme de flèche
- Labels d'audience avec couleurs vives et pleines
- Blocs d'offres plus grands avec toutes les informations visibles
- Mise en page professionnelle type "plan marketing"

