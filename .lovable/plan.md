

# Ajouter un onglet "Temps de préparation" dans la section Opérations

## Contexte du problème

Actuellement, quand on clique sur un restaurant dans le "Classement par rapidité" de la page Comparaison Temps de préparation, la navigation redirige vers l'onglet **"Temps d'attente"** (`/analytics/operations?tab=waitTime`).

Or ce sont deux métriques totalement différentes :
- **Temps de préparation** = temps entre l'acceptation de la commande et la fin de préparation (côté cuisine) → `initial_prep_time_minutes`
- **Temps d'attente** = temps que le livreur attend à son arrivée au restaurant (côté coursier) → `avoidable_wait_time_minutes`

## Solution proposée

Créer un **4ème onglet "Temps de préparation"** dans la section Opérations, avec les mêmes visualisations que l'onglet "Temps d'attente" mais adaptées aux données de préparation.

## Structure des onglets après modification

| Onglet | Icône | Métrique | Source de données |
|--------|-------|----------|-------------------|
| Disponibilité | Store | Taux de disponibilité | `hourly_availability` |
| **Temps de préparation (NOUVEAU)** | Timer/ChefHat | Temps cuisine | `order_history.initial_prep_time_minutes` |
| Temps d'attente | Clock | Attente coursier | `order_history.avoidable_wait_time_minutes` |
| Erreurs commandes | AlertTriangle | Erreurs | `order_errors` |

## Fichiers à créer

### 1. `src/components/analytics/PrepTimeAnalytics.tsx` (nouveau fichier)

Composant similaire à `WaitTimeAnalytics.tsx` mais adapté pour le temps de préparation :

**KPIs à afficher :**
- Temps de préparation moyen
- Nombre de commandes analysées  
- Objectif atteint (≤ 6 min)
- Tendance vs période précédente

**Visualisations :**
- Graphique d'évolution (jour/mois) avec ligne d'objectif (6 min par défaut)
- Drill-down mois → jour → heure
- Heatmap (jour de la semaine × heure)
- Classement des restaurants (du plus rapide au plus lent)

**Logique technique :**
```typescript
// Requête similaire à WaitTimeAnalytics mais avec prep time
const { data } = await supabase
  .from("order_history")
  .select("id, restaurant_id, order_datetime, initial_prep_time_minutes")
  .not("initial_prep_time_minutes", "is", null)
  .gte("order_datetime", startDate)
  .lte("order_datetime", endDate)
  .in("restaurant_id", selectedRestaurants);

// Seuils de couleur pour prep time
const getBarColor = (prepTimeMinutes: number) => {
  if (prepTimeMinutes <= 4) return "green";   // Excellent
  if (prepTimeMinutes <= 6) return "amber";   // OK
  return "red";                                // À améliorer
};
```

## Fichiers à modifier

### 2. `src/components/analytics/OperationsAnalytics.tsx`

**Modifications :**
1. Importer le nouveau composant `PrepTimeAnalytics`
2. Ajouter `"prepTime"` au type de l'état `activeTab`
3. Ajouter un 4ème onglet dans la `TabsList` (passer de `grid-cols-3` à `grid-cols-4`)
4. Ajouter le `TabsContent` pour le nouvel onglet

```typescript
// État mis à jour
const [activeTab, setActiveTab] = useState<
  "availability" | "prepTime" | "waitTime" | "orderErrors"
>(() => { ... });

// Nouveau trigger dans TabsList
<TabsTrigger value="prepTime">
  <Timer className="h-4 w-4" />
  Temps de préparation
</TabsTrigger>

// Nouveau contenu
<TabsContent value="prepTime">
  <PrepTimeAnalytics />
</TabsContent>
```

### 3. `src/components/compare/PrepTimeRankingBars.tsx`

**Modification ligne 80 :** Changer la navigation pour pointer vers le nouvel onglet

```typescript
// AVANT
navigate("/analytics/operations?tab=waitTime");

// APRÈS  
navigate("/analytics/operations?tab=prepTime");
```

## Design de l'interface PrepTimeAnalytics

Le composant reprendra la même structure visuelle que `WaitTimeAnalytics` :

```text
┌──────────────────────────────────────────────────────────────┐
│  KPIs Cards (5 cartes)                                       │
│  ┌─────┐ ┌─────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│  │ Avg │ │ Nb  │ │ Temps total │ │  Objectif   │ │ Tendance│ │
│  │4.2mn│ │1984 │ │   moyen     │ │ atteint 85% │ │  -12%   │ │
│  └─────┘ └─────┘ └─────────────┘ └─────────────┘ └─────────┘ │
├──────────────────────────────────────────────────────────────┤
│  Graphique d'évolution                                       │
│  [Retour] Janvier 2026 [<] [>]          Objectif: [6 min]    │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 8min ┤                                                   ││
│  │ 6min ┤ ─ ─ ─ ─ ─ ─ ─ OBJECTIF ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   ││
│  │ 4min ┤ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █            ││
│  │ 2min ┤                                                   ││
│  │ 0min ┼─────────────────────────────────────────────────  ││
│  │       1  2  3  4  5 ... 30 31                            ││
│  └──────────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────┤
│  Heatmap + Classement (2 colonnes)                           │
│  ┌──────────────────────┐ ┌─────────────────────────────────┐│
│  │  Heatmap             │ │  Classement restaurants         ││
│  │  (heure × jour)      │ │  🥇 Athis-Mons    4m 12s        ││
│  │                      │ │  🥈 Bonneuil      5m 33s        ││
│  │                      │ │  🥉 Antony        6m 45s        ││
│  └──────────────────────┘ └─────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

## Résumé des changements

| Fichier | Action |
|---------|--------|
| `src/components/analytics/PrepTimeAnalytics.tsx` | **Créer** - Nouveau composant complet |
| `src/components/analytics/OperationsAnalytics.tsx` | **Modifier** - Ajouter l'onglet et son contenu |
| `src/components/compare/PrepTimeRankingBars.tsx` | **Modifier** - Corriger la navigation (ligne 80) |

## Complexité estimée

- **Fichier à créer** : ~800-900 lignes (basé sur WaitTimeAnalytics qui fait 939 lignes)
- **Modifications** : ~50 lignes dans les fichiers existants
- **Temps estimé** : ~15-20 minutes de génération

