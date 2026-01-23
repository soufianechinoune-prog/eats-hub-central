
# Ajouter l'onglet "Temps Prépa+Livraison" dans Operations

## Contexte

La colonne **"Temps total de préparation et de livraison"** du fichier CSV Uber Eats est déjà parsée et stockée dans `total_prep_delivery_time_minutes` dans la table `order_history`. Cette métrique mesure le temps total depuis la commande jusqu'à la livraison au client (préparation cuisine + trajet coursier).

## Solution proposée

Créer un nouvel onglet dans la section Operations Analytics pour visualiser cette donnée avec les mêmes composants que les autres onglets :
- KPIs (moyenne, pourcentage sous objectif)
- Graphique d'évolution (journalier/mensuel)
- Heatmap horaire
- Classement des restaurants

---

## Fichiers à créer

### 1. `src/components/analytics/TotalDeliveryTimeAnalytics.tsx`

Nouveau composant basé sur la structure de `PrepTimeAnalytics.tsx` mais utilisant la colonne `total_prep_delivery_time_minutes` :

**Fonctionnalités :**
- Fetch des données `order_history` avec `total_prep_delivery_time_minutes`
- KPIs : Temps moyen, % des commandes sous objectif (ex: 35 min), volume de commandes
- Graphique évolution : mensuel/journalier/horaire selon le mode de période
- Heatmap : visualisation par jour/heure
- Classement restaurants : du plus rapide au plus lent

**Différences avec PrepTimeAnalytics :**
| Aspect | Temps de prépa | Temps total prépa+livraison |
|--------|----------------|------------------------------|
| Colonne DB | `initial_prep_time_minutes` | `total_prep_delivery_time_minutes` |
| Objectif par défaut | 6 min | 35 min |
| Échelle typique | 3-15 min | 15-60 min |
| Icône | ChefHat | Truck |

---

## Fichiers à modifier

### 2. `src/components/analytics/OperationsAnalytics.tsx`

**Changements :**

1. **Import du nouveau composant :**
```typescript
import { TotalDeliveryTimeAnalytics } from "./TotalDeliveryTimeAnalytics";
```

2. **Ajouter le type de tab :**
```typescript
// Ligne 59 - Ajouter "totalDelivery" aux types possibles
const [activeTab, setActiveTab] = useState<"availability" | "prepTime" | "waitTime" | "orderErrors" | "uberOne" | "totalDelivery">
```

3. **Modifier la grille TabsList (6 colonnes):**
```typescript
<TabsList className="grid w-full max-w-5xl grid-cols-6 h-12 ...">
```

4. **Ajouter le nouvel onglet dans TabsList (après waitTime) :**
```typescript
<TabsTrigger value="totalDelivery" ...>
  <Truck className="h-4 w-4" />
  <span className="hidden sm:inline">Prépa+Livraison</span>
  <span className="sm:hidden">Total</span>
</TabsTrigger>
```

5. **Ajouter le TabsContent :**
```typescript
<TabsContent value="totalDelivery" className="mt-6">
  <TotalDeliveryTimeAnalytics />
</TabsContent>
```

---

## Structure du nouveau composant

Le composant `TotalDeliveryTimeAnalytics` aura cette structure :

```text
┌─────────────────────────────────────────────────────────────────┐
│  KPIs (3 cards)                                                  │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│  │ Temps moyen   │ │ % sous 35min  │ │ Commandes     │          │
│  │ 28min 45s     │ │ 72%           │ │ 1 234         │          │
│  └───────────────┘ └───────────────┘ └───────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  Graphique d'évolution (avec slider objectif 25-50 min)         │
│  [LineChart / BarChart selon sélection]                         │
│  Navigation: < Mois précédent | Mois suivant >                  │
├─────────────────────────────────────────────────────────────────┤
│  Heatmap horaire                                                 │
│  Lun-Dim x 0h-23h avec intensité couleur                        │
├─────────────────────────────────────────────────────────────────┤
│  Classement restaurants (plus rapides en haut)                  │
│  🥇 Restaurant A - 24min | 🥈 Restaurant B - 28min | ...        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Résumé des changements

| Fichier | Action |
|---------|--------|
| `src/components/analytics/TotalDeliveryTimeAnalytics.tsx` | Créer (~800 lignes, basé sur PrepTimeAnalytics) |
| `src/components/analytics/OperationsAnalytics.tsx` | Modifier (import, tabs, TabsContent) |

---

## Section technique

### Requête Supabase

```typescript
supabase
  .from("order_history")
  .select("id, restaurant_id, order_datetime, total_prep_delivery_time_minutes")
  .gte("order_datetime", startDate)
  .lte("order_datetime", endDate)
  .not("total_prep_delivery_time_minutes", "is", null)
```

### Seuils de couleur suggérés

| Temps total | Couleur |
|-------------|---------|
| < 25 min | Vert (excellent) |
| 25-35 min | Jaune (correct) |
| 35-45 min | Orange (attention) |
| > 45 min | Rouge (problème) |

Ces seuils sont adaptés au temps total (prépa + livraison) qui est naturellement plus long que le temps de préparation seul.
