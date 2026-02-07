

# Plan : Persister le filtre de période sur la page Comparaison Downtime

## Problème identifié

Quand vous êtes sur la page **Comparaison Temps d'inactivité** avec le filtre "Janvier 2026" et que vous cliquez sur un restaurant puis faites "retour", le filtre se réinitialise à "Semaine précédente".

**Cause technique :**
- La page `DowntimeComparison.tsx` utilise `useState` avec des valeurs par défaut
- Ces valeurs ne sont pas persistées dans `localStorage`
- Quand le composant est remonté (après navigation retour), il s'initialise avec les valeurs par défaut

```typescript
// Actuellement (ligne 19)
const [periodMode, setPeriodMode] = useState<OverviewPeriodMode>("previous_week");
```

---

## Solution

Ajouter une persistance locale similaire à celle utilisée dans `AnalyticsContext.tsx` :
1. Créer une clé `downtime-comparison-state` dans localStorage
2. Initialiser les états depuis cette clé au montage
3. Sauvegarder les changements automatiquement

---

## Fichier à modifier

**`src/pages/DowntimeComparison.tsx`**

---

## Modifications

### 1. Ajouter la clé de stockage et la lecture initiale

```typescript
const STORAGE_KEY = "downtime-comparison-state";

// Lecture initiale depuis localStorage
const getInitialState = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};
```

### 2. Initialiser les états depuis localStorage

```typescript
const DowntimeComparison = () => {
  const navigate = useNavigate();
  const storedState = getInitialState();
  
  const [periodMode, setPeriodMode] = useState<OverviewPeriodMode>(
    () => storedState?.periodMode || "previous_week"
  );
  const [selectedYear, setSelectedYear] = useState(
    () => storedState?.selectedYear || new Date().getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState(
    () => storedState?.selectedMonth || new Date().getMonth() + 1
  );
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(() => {
    if (storedState?.customDateRange?.from && storedState?.customDateRange?.to) {
      return {
        from: new Date(storedState.customDateRange.from),
        to: new Date(storedState.customDateRange.to),
      };
    }
    return undefined;
  });
  const [isNetworkView, setIsNetworkView] = useState(
    () => storedState?.isNetworkView ?? false
  );
```

### 3. Ajouter un useEffect pour persister les changements

```typescript
// Persister l'état dans localStorage
useEffect(() => {
  const state = {
    periodMode,
    selectedYear,
    selectedMonth,
    customDateRange: customDateRange ? {
      from: customDateRange.from?.toISOString(),
      to: customDateRange.to?.toISOString(),
    } : undefined,
    isNetworkView,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}, [periodMode, selectedYear, selectedMonth, customDateRange, isNetworkView]);
```

---

## Comportement attendu

| Scénario | Avant | Après |
|----------|-------|-------|
| Page ouverte avec "Janvier 2026" | ✓ Affiche Janvier | ✓ Affiche Janvier |
| Clic sur restaurant → détail | ✓ Naviguer | ✓ Naviguer |
| Retour arrière | ✗ Revient à "Semaine précédente" | ✓ Reste sur "Janvier 2026" |
| Fermer/rouvrir la page | ✗ Perd le filtre | ✓ Restaure le filtre |

Le filtre sera conservé non seulement lors du retour arrière, mais aussi entre les sessions (rechargement de page, fermeture/réouverture).

