
# Synchroniser les filtres entre Analytics et Comparaison Temps de préparation

## Problème identifié

Les deux pages affichent des valeurs différentes pour Athis-Mons :
- **Analytics** : 7min 16s sur **1592 commandes**
- **Comparaison** : 6min 33s sur **661 commandes**

### Causes du décalage

| Critère | Analytics (PrepTimeAnalytics) | Comparaison (PrepTimeComparison) |
|---------|------------------------------|----------------------------------|
| Source restaurants | `selectedRestaurants` du contexte global | `pinnedRestaurants` (is_pinned = true uniquement) |
| Filtre plateforme | **Oui** (Uber Eats sélectionné) | **Non** (toutes plateformes) |
| Période | Date range du contexte (12-18 janv) | Calcul indépendant (semaine précédente) |

Le paradoxe (moins de commandes sans filtre plateforme) s'explique par le fait que la page Comparaison ne filtre **pas sur la plateforme**. Les 661 commandes sont donc un sous-ensemble différent.

## Solution proposée

### 1. Ajouter le filtre plateforme dans PrepTimeComparison.tsx

Modifier la requête de données (lignes 70-77) pour accepter un paramètre plateforme :

```typescript
// Ajouter un state pour la plateforme sélectionnée
const [selectedPlatform, setSelectedPlatform] = useState<"uber_eats" | "deliveroo" | "global">("global");

// Dans la requête
let query = supabase
  .from("order_history")
  .select("restaurant_id, initial_prep_time_minutes, order_datetime")
  .in("restaurant_id", restaurantIds)
  .gte("order_datetime", dateRange.start.toISOString())
  .lte("order_datetime", dateRange.end.toISOString())
  .not("initial_prep_time_minutes", "is", null);

// Ajouter le filtre plateforme
if (selectedPlatform === "uber_eats" || selectedPlatform === "deliveroo") {
  query = query.eq("platform", selectedPlatform);
}
```

### 2. Synchroniser les périodes avec le contexte global

Au lieu de calculer la période de façon indépendante, utiliser le `dateRange` du contexte Analytics :

```typescript
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

const {
  dateRange: contextDateRange,
  selectedPlatform,
} = useAnalyticsContext();

// Utiliser directement le contexte
const dateRange = useMemo(() => {
  if (contextDateRange?.from && contextDateRange?.to) {
    return { start: contextDateRange.from, end: contextDateRange.to };
  }
  // Fallback si pas de contexte
  return { start: subDays(new Date(), 7), end: new Date() };
}, [contextDateRange]);
```

### 3. Ajouter un sélecteur de plateforme dans l'UI

À côté du sélecteur de période, ajouter les boutons Uber Eats / Deliveroo / Global :

```typescript
<div className="flex items-center gap-2">
  <Button 
    variant={selectedPlatform === "uber_eats" ? "default" : "outline"}
    onClick={() => setSelectedPlatform("uber_eats")}
  >
    Uber Eats
  </Button>
  <Button 
    variant={selectedPlatform === "deliveroo" ? "default" : "outline"}
    onClick={() => setSelectedPlatform("deliveroo")}
  >
    Deliveroo
  </Button>
  <Button 
    variant={selectedPlatform === "global" ? "default" : "outline"}
    onClick={() => setSelectedPlatform("global")}
  >
    Global
  </Button>
</div>
```

## Fichiers à modifier

| Fichier | Modification |
|---------|--------------|
| `src/pages/PrepTimeComparison.tsx` | Importer AnalyticsContext, utiliser ses filtres (dateRange, platform), ajouter UI plateforme |
| `src/components/compare/PrepTimeRankingBars.tsx` | Passer le dateRange depuis le contexte lors de la navigation vers Analytics |

## Résultat attendu

Après cette modification :
- Les **mêmes filtres** (période + plateforme) seront appliqués sur les deux pages
- Les valeurs seront **identiques** pour le même restaurant
- La navigation entre les pages **préservera le contexte**
