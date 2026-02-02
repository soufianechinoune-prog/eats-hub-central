

# Correction du sélecteur de période WhatsApp

## Problèmes à corriger

### 1. Fermeture prématurée du calendrier
Le popover se ferme dès le premier clic car la logique actuelle considère que la plage est complète quand `from === to` (première sélection). Il faut attendre que l'utilisateur clique sur **deux dates différentes** avant de fermer.

### 2. Labels S-1, S-2 pas clairs
Les raccourcis "S-1", "S-2" ne sont pas explicites. Ajouter les dates réelles sous chaque bouton ou remplacer par un texte plus descriptif.

## Modifications

| Fichier | Action |
|---------|--------|
| `src/components/messaging/WeeklyReports.tsx` | Corriger la logique de sélection + améliorer les labels |

## Détails d'implémentation

### 1. Corriger la fermeture prématurée

Modifier la fonction `handleDateRangeSelect` pour ne fermer le popover que lorsque les deux dates sont différentes :

```typescript
const handleDateRangeSelect = (range: DateRange | undefined) => {
  if (range?.from) {
    setPeriodStart(range.from);
  }
  if (range?.to) {
    setPeriodEnd(range.to);
    // Ne fermer que si from et to sont différents (sélection complète)
    if (range.from && range.to && range.from.getTime() !== range.to.getTime()) {
      setPeriodPopoverOpen(false);
    }
  }
};
```

### 2. Améliorer les labels des raccourcis

Remplacer les labels cryptiques par des textes plus explicites avec les dates réelles :

```typescript
{/* Quick selection buttons */}
<div className="flex flex-wrap gap-2 mb-4">
  {[1, 2, 3, 4].map((offset) => {
    const weekStart = startOfWeek(subWeeks(new Date(), offset), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const isSelected = periodStart.getTime() === weekStart.getTime();
    
    return (
      <Button
        key={offset}
        size="sm"
        variant={isSelected ? "default" : "outline"}
        onClick={() => setWeekOffset(offset)}
        className="text-xs flex-col h-auto py-2"
      >
        <span className="font-medium">Sem. -{offset}</span>
        <span className="text-[10px] opacity-70">
          {format(weekStart, "d", { locale: fr })}-{format(weekEnd, "d MMM", { locale: fr })}
        </span>
      </Button>
    );
  })}
</div>
```

### 3. Ajouter un bouton de confirmation optionnel

Pour plus de clarté, ajouter un bouton "Valider" en bas du calendrier :

```typescript
<div className="flex justify-end mt-3 pt-3 border-t">
  <Button
    size="sm"
    onClick={() => setPeriodPopoverOpen(false)}
    className="text-xs"
  >
    Valider la période
  </Button>
</div>
```

## Résultat visuel attendu

```text
┌────────────────────────────────────────┐
│  [Sem. -1]   [Sem. -2]   [Sem. -3]    │
│   20-26 jan   13-19 jan   6-12 jan    │
├────────────────────────────────────────┤
│            février 2026               │
│  lu   ma   me   je   ve   sa   di     │
│  ...                                   │
├────────────────────────────────────────┤
│                      [Valider la période]│
└────────────────────────────────────────┘
```

## Avantages

- Le calendrier reste ouvert jusqu'à la sélection complète ou clic sur "Valider"
- Les raccourcis affichent clairement les dates concernées
- Le bouton sélectionné est mis en évidence visuellement
- Expérience utilisateur améliorée avec moins de confusion

