

# Ajout d'un Sélecteur de Période pour les Rapports WhatsApp

## Contexte du problème

Actuellement, les rapports sont générés automatiquement sur "la semaine dernière" calculée par le système. Mais les données importées peuvent ne pas être à jour jusqu'à cette date. Tu as besoin de pouvoir **choisir manuellement la période** car tu sais exactement jusqu'à quelles dates les données sont disponibles.

## Solution proposée

Ajouter un **sélecteur de période interactif** dans l'en-tête de la page "Rapports WhatsApp", juste à côté du texte "Semaine du X au Y".

## Interface utilisateur

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Rapports WhatsApp                                                   │
│ Période: [📅 20 janv. - 26 janv. 2026 ▼]  [◀ Semaine préc.] [Suiv. ▶]│
├─────────────────────────────────────────────────────────────────────┤
```

### Fonctionnalités du sélecteur

1. **Mode Semaine (par défaut)** : Navigation par semaine complète (lundi-dimanche)
2. **Mode Plage personnalisée** : Sélection libre de dates début/fin
3. **Boutons de navigation** : Semaine précédente / Semaine suivante
4. **Raccourcis rapides** : "Semaine dernière", "Semaine -2", "Mois en cours"

## Modifications techniques

| Fichier | Action |
|---------|--------|
| `src/components/messaging/WeeklyReports.tsx` | Ajouter le sélecteur de période dans l'en-tête |

### Détails d'implémentation

#### 1. Nouveaux états pour la période

```typescript
// Remplacer le useMemo lastWeek fixe par des états contrôlables
const [periodStart, setPeriodStart] = useState<Date>(() => {
  const now = new Date();
  return startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
});
const [periodEnd, setPeriodEnd] = useState<Date>(() => {
  const now = new Date();
  return endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
});
```

#### 2. Composant de sélection de période

```typescript
// Dans l'en-tête, après le titre
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" className="gap-2">
      <CalendarDays className="h-4 w-4" />
      {format(periodStart, "d MMM", { locale: fr })} - {format(periodEnd, "d MMM yyyy", { locale: fr })}
      <ChevronDown className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-4" align="start">
    {/* Raccourcis rapides */}
    <div className="flex flex-wrap gap-2 mb-4">
      <Button size="sm" variant="outline" onClick={() => setWeekOffset(-1)}>
        Semaine -1
      </Button>
      <Button size="sm" variant="outline" onClick={() => setWeekOffset(-2)}>
        Semaine -2
      </Button>
      <Button size="sm" variant="outline" onClick={() => setWeekOffset(-3)}>
        Semaine -3
      </Button>
    </div>
    
    {/* Calendrier avec sélection de plage */}
    <Calendar
      mode="range"
      selected={{ from: periodStart, to: periodEnd }}
      onSelect={(range) => {
        if (range?.from) setPeriodStart(range.from);
        if (range?.to) setPeriodEnd(range.to);
      }}
      locale={fr}
    />
  </PopoverContent>
</Popover>

{/* Navigation semaine */}
<div className="flex items-center gap-1">
  <Button variant="ghost" size="icon" onClick={() => navigateWeek(-1)}>
    <ChevronLeft className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="icon" onClick={() => navigateWeek(1)}>
    <ChevronRight className="h-4 w-4" />
  </Button>
</div>
```

#### 3. Fonctions de navigation

```typescript
const navigateWeek = (offset: number) => {
  setPeriodStart(prev => {
    const newStart = new Date(prev);
    newStart.setDate(newStart.getDate() + (offset * 7));
    return startOfWeek(newStart, { weekStartsOn: 1 });
  });
  setPeriodEnd(prev => {
    const newEnd = new Date(prev);
    newEnd.setDate(newEnd.getDate() + (offset * 7));
    return endOfWeek(newEnd, { weekStartsOn: 1 });
  });
};

const setWeekOffset = (weeksBack: number) => {
  const targetWeek = subWeeks(new Date(), Math.abs(weeksBack));
  setPeriodStart(startOfWeek(targetWeek, { weekStartsOn: 1 }));
  setPeriodEnd(endOfWeek(targetWeek, { weekStartsOn: 1 }));
};
```

#### 4. Mise à jour des appels API

Remplacer toutes les références à `lastWeek.start` et `lastWeek.end` par `periodStart` et `periodEnd` :

```typescript
// Dans generateUnifiedReports()
start_date: format(periodStart, "yyyy-MM-dd"),
end_date: format(periodEnd, "yyyy-MM-dd"),

// Dans sendReports()
report_start_date: format(periodStart, "yyyy-MM-dd"),
report_end_date: format(periodEnd, "yyyy-MM-dd"),

// Dans generateMessage()
const dateStart = format(periodStart, "d MMMM", { locale: fr });
const dateEnd = format(periodEnd, "d MMMM", { locale: fr });
```

## Résultat visuel

L'en-tête de la page affichera :

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Rapports WhatsApp                                [◀] [📅 20-26 jan. 2026 ▼] [▶]│
│                                                                     │
│ [Rapports] [Envoi (0)] [Historique]                                │
└─────────────────────────────────────────────────────────────────────┘
```

En cliquant sur le bouton date, un popover s'ouvre avec :
- Des raccourcis "Semaine -1", "Semaine -2", "Semaine -3"
- Un calendrier pour sélection libre

## Avantages

- Tu peux choisir exactement la période pour laquelle tu as des données
- Navigation rapide entre les semaines avec les flèches
- Raccourcis pour aller directement à S-1, S-2, S-3
- Possibilité de sélectionner une plage personnalisée (pas forcément une semaine complète)
- L'IA générera des rapports sur les bonnes données

## Dépendances

Utilise les composants déjà présents dans le projet :
- `Calendar` (react-day-picker)
- `Popover` (@radix-ui/react-popover)
- `Button` (composant UI existant)

