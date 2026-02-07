

# Plan : Synchroniser les statistiques entre les pages Analytics et Comparaison Downtime

## Problème identifié

Après investigation approfondie, deux causes expliquent les écarts de statistiques observés :

### 1. Pagination - Déjà corrigé

La page Comparaison ne récupérait que 1000 lignes au lieu de ~1656, causant des calculs erronés. Cette correction a été appliquée.

### 2. Contexte de filtrage différent

| Aspect | Page Analytics | Page Comparaison |
|--------|---------------|------------------|
| Filtre plateforme | Uber Eats / Deliveroo / Global | Aucun filtre |
| Source période | AnalyticsContext | État local |
| Source restaurants | AnalyticsContext | Restaurants épinglés |

Quand l'utilisateur navigue de la page Comparaison vers Analytics (en cliquant sur un restaurant), le contexte est synchronisé. Mais si les périodes affichées diffèrent légèrement (ex: "Semaine précédente" recalculée vs période stockée), les données peuvent varier.

---

## Solution proposée

### Aligner le filtre de plateforme dans la page Comparaison

**Fichier : `src/pages/DowntimeComparison.tsx`**

Actuellement, la requête ne filtre pas par plateforme :
```typescript
.from("hourly_availability")
.select("*")
.in("restaurant_id", selectedRestaurants.map(r => r.id))
```

Ajouter un filtre `uber_eats` par défaut (comme la page Analytics) :
```typescript
.from("hourly_availability")
.select("*")
.in("restaurant_id", selectedRestaurants.map(r => r.id))
.eq("platform", "uber_eats")  // Aligner avec le comportement par défaut Analytics
```

### Alternative : Ajouter un sélecteur de plateforme

Si le besoin est de voir plusieurs plateformes, ajouter un `PlatformSelector` dans l'en-tête de la page Comparaison pour permettre le choix explicite.

---

## Section technique

### Modification requise

```typescript
// src/pages/DowntimeComparison.tsx - ligne 118
while (hasMore) {
  const { data, error } = await supabase
    .from("hourly_availability")
    .select("*")
    .in("restaurant_id", selectedRestaurants.map(r => r.id))
    .eq("platform", "uber_eats")  // NOUVEAU: aligner avec Analytics
    .gte("hour_start", format(dateRange.start, "yyyy-MM-dd"))
    .lte("hour_start", format(dateRange.end, "yyyy-MM-dd'T'23:59:59"))
    .order("hour_start", { ascending: true })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
```

### Impact

Cette modification garantit que les deux pages utilisent le même sous-ensemble de données (plateforme Uber Eats), éliminant les écarts potentiels si d'autres plateformes sont ajoutées à l'avenir.

---

## Résultat attendu

| Restaurant | Avant (Comparaison) | Après (Comparaison) | Analytics |
|------------|---------------------|---------------------|-----------|
| Bourg-en-Bresse | 90.5% | 93.2% | 93.2% |
| Marseille Belsunce | 92.2% | 93.6% | 93.6% |

Les deux pages afficheront des données identiques pour la même période et les mêmes restaurants.

