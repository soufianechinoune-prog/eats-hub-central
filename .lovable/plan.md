
# Plan : Ajouter le Badge Success Score sur la carte Uber Eats

## Objectif
Afficher le badge Success Score (Excellent, Très Bon, Bon, Correct, Insuffisant) directement sur la vignette "Uber Eats" de la page Overview, car ce score est spécifique à cette plateforme.

---

## Approche

### 1. Récupérer le Success Score réseau

Ajouter une requête dans la page Overview pour récupérer les scores du mois le plus récent :

```typescript
// Fetch latest Success Score for network overview
const { data: successScoreData } = useQuery({
  queryKey: ["network-success-score"],
  queryFn: async () => {
    // Get the most recent month available
    const { data: scores } = await supabase
      .from("success_scores")
      .select("score_tier, restaurant_id")
      .order("score_month", { ascending: false })
      .limit(100);
    
    if (!scores || scores.length === 0) return null;
    
    // Count by tier to find the dominant one
    const tierCounts: Record<string, number> = {};
    scores.forEach(s => {
      if (s.score_tier) {
        tierCounts[s.score_tier] = (tierCounts[s.score_tier] || 0) + 1;
      }
    });
    
    // Find the most common tier
    const dominantTier = Object.entries(tierCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    
    return {
      dominantTier,
      tierCounts,
      total: scores.length
    };
  },
});
```

### 2. Configurer les badges (réutiliser la config de SuccessScore.tsx)

```typescript
const TIER_BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  Excellent: { label: 'Excellent', color: 'bg-emerald-500' },
  Great: { label: 'Très Bon', color: 'bg-blue-500' },
  Good: { label: 'Bon', color: 'bg-amber-500' },
  Fair: { label: 'Correct', color: 'bg-orange-500' },
  Poor: { label: 'Insuffisant', color: 'bg-red-500' },
};
```

### 3. Afficher le badge dans le header de la carte Uber Eats

Modifier la carte Uber Eats (lignes 962-985) pour ajouter le badge à côté du titre :

```text
┌─────────────────────────────────────────┐
│ [🍔]  Uber Eats          [Correct]     │
│       Semaine précédente                │
├─────────────────────────────────────────┤
│ ⭐ Note moyenne                   4.5/5 │
│ ⏱  Temps préparation            8 min  │
│ ...                                     │
└─────────────────────────────────────────┘
```

Le badge sera cliquable et redirigera vers la page `/success-score`.

---

## Modifications techniques

### Fichier : `src/pages/Overview.tsx`

| Section | Modification |
|---------|--------------|
| Imports | Ajouter `Badge` de `@/components/ui/badge` |
| Requêtes | Ajouter `useQuery` pour récupérer `success_scores` |
| Config | Ajouter `TIER_BADGE_CONFIG` pour les couleurs |
| Carte Uber Eats | Ajouter le badge cliquable dans le `CardHeader` |

### Code du badge dans la carte

```typescript
{/* Uber Eats Card Header */}
<div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    <div className="h-12 w-12 rounded-xl bg-uber/10 flex items-center justify-center">
      <UberEatsLogo size={24} />
    </div>
    <div>
      <CardTitle className="text-xl">Uber Eats</CardTitle>
      <p className="text-xs text-muted-foreground mt-0.5">{getPeriodLabel()}</p>
    </div>
  </div>
  
  {/* Success Score Badge */}
  {successScoreData?.dominantTier && (
    <Badge 
      className={`${TIER_BADGE_CONFIG[successScoreData.dominantTier]?.color} text-white cursor-pointer hover:opacity-80`}
      onClick={() => navigate('/success-score')}
    >
      {TIER_BADGE_CONFIG[successScoreData.dominantTier]?.label}
    </Badge>
  )}
</div>
```

---

## Résultat visuel attendu

La carte Uber Eats affichera :
- Le logo et titre à gauche
- Un badge coloré à droite (ex: badge orange "Correct")
- Un clic sur le badge navigue vers `/success-score`

---

## Récapitulatif

| Fichier | Modification |
|---------|--------------|
| `src/pages/Overview.tsx` | Ajouter requête Success Score + badge dans carte Uber Eats |
