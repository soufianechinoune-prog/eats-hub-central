

# Analyse Uber One vs Non Uber One

## Objectif

Créer une visualisation de la proportion des clients Uber One vs non-Uber One pour comprendre la composition de la clientèle et son évolution.

## Données disponibles

La table `order_history` contient le champ `uber_one` (boolean) avec des données fiables :
- 62.7% de clients Uber One (32 746 commandes en 2025)
- 37.3% de clients non-Uber One (19 493 commandes)
- Tendance à la hausse : de 60% (juin 2025) à 66.3% (janvier 2026)

---

## Solution proposée

### Nouveau composant : `src/components/analytics/UberOneAnalysis.tsx`

Un composant affichant :

1. **KPI principal** : Pourcentage Uber One avec jauge visuelle
2. **Graphique d'évolution** : Courbe mensuelle du % Uber One
3. **Comparaison par restaurant** : Barres horizontales classant les restaurants
4. **Tableau comparatif** : Uber One vs Non-Uber One (panier moyen, temps prep, volume)

### Nouveau hook : `src/hooks/useUberOneStats.ts`

Centralise les requêtes Supabase pour récupérer :
- Proportion globale Uber One / Non-Uber One
- Évolution mensuelle
- Breakdown par restaurant
- Métriques comparatives (panier moyen, temps prep)

### Emplacement

Intégrer dans la page **Analytics > Operations** (`/analytics/operations`) dans un nouvel onglet "Clientèle" ou directement dans l'onglet existant.

Alternative : Ajouter dans la page **Overview** comme nouvelle carte "Répartition clientèle".

---

## Visualisation proposée

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  RÉPARTITION CLIENTÈLE UBER                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────┐   ┌────────────────────────────────────────────┐   │
│  │                    │   │ Évolution % Uber One                       │   │
│  │   ████████  62.7%  │   │                                            │   │
│  │   Uber One         │   │  66% ─────────────────────────────● Jan 26 │   │
│  │                    │   │  64% ─────────────────────●───────         │   │
│  │   ░░░░░░░░  37.3%  │   │  62% ─────────────●───────                 │   │
│  │   Standard         │   │  60% ●────────────                         │   │
│  │                    │   │      Juin  Sept  Nov  Jan                  │   │
│  └────────────────────┘   └────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Comparaison par restaurant                                            │  │
│  │                                                                        │  │
│  │ Antony      ████████████████████████████████████  66.9%               │  │
│  │ Bonneuil    ██████████████████████████████████    64.9%               │  │
│  │ Juvisy      ████████████████████████████████      62.8%               │  │
│  │ Athis-Mons  ██████████████████████████████        60.4%               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Comportement comparé                                                  │  │
│  │                                                                        │  │
│  │                    Uber One          Standard         Différence      │  │
│  │ Panier moyen       23.82 €           24.18 €          -1.5%           │  │
│  │ Temps prep         8.2 min           8.3 min          -1.2%           │  │
│  │ Volume             32 746            19 493           +68%            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implémentation technique

### Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `src/hooks/useUberOneStats.ts` | Hook pour récupérer les stats Uber One depuis `order_history` |
| `src/components/analytics/UberOneAnalysis.tsx` | Composant principal avec graphiques et tableaux |

### Fichier à modifier

| Fichier | Modification |
|---------|--------------|
| `src/pages/Analytics.tsx` | Ajouter le composant dans la vue Operations ou créer un nouvel onglet |

### Logique du hook

```typescript
export function useUberOneStats({
  restaurantIds,
  startDate,
  endDate
}: UseUberOneStatsParams) {
  // Query 1: Proportion globale
  const { data: globalStats } = useQuery({
    queryKey: ["uber-one-global", restaurantIds, startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_history")
        .select("uber_one")
        .in("restaurant_id", restaurantIds)
        .gte("order_datetime", startDate)
        .lte("order_datetime", endDate);
      
      const uberOneCount = data?.filter(d => d.uber_one).length || 0;
      const total = data?.length || 0;
      return {
        uberOneCount,
        nonUberOneCount: total - uberOneCount,
        uberOnePercent: total > 0 ? (uberOneCount / total) * 100 : 0
      };
    }
  });

  // Query 2: Évolution mensuelle
  // Query 3: Par restaurant
  // Query 4: Métriques comparatives (panier, temps prep)
  
  return { globalStats, evolution, byRestaurant, comparison, isLoading };
}
```

---

## Insights métier potentiels

Le composant pourra mettre en évidence :
- **Tendance croissante** : +6 points en 6 mois (60% → 66%)
- **Différence de panier** : Les clients Uber One ont un panier légèrement inférieur (-1.5%)
- **Volume dominant** : Uber One représente 2/3 des commandes
- **Variation par restaurant** : Antony a plus de clients Uber One (66.9%) qu'Athis-Mons (60.4%)

