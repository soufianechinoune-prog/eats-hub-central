

# Plan : Ajouter le Badge Success Score sur la carte Uber Eats

## Contexte
Le plan a été approuvé précédemment mais n'a pas été implémenté. Voici les modifications à effectuer.

---

## Modifications à apporter

### Fichier : `src/pages/Overview.tsx`

#### 1. Ajouter l'import du Badge
```typescript
import { Badge } from "@/components/ui/badge";
```

#### 2. Ajouter la configuration des tiers
```typescript
const TIER_BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  Excellent: { label: 'Excellent', color: 'bg-emerald-500' },
  Great: { label: 'Très Bon', color: 'bg-blue-500' },
  Good: { label: 'Bon', color: 'bg-amber-500' },
  Fair: { label: 'Correct', color: 'bg-orange-500' },
  Poor: { label: 'Insuffisant', color: 'bg-red-500' },
};
```

#### 3. Ajouter la requête pour récupérer le Success Score
```typescript
const { data: successScoreData } = useQuery({
  queryKey: ["network-success-score"],
  queryFn: async () => {
    const { data: scores } = await supabase
      .from("success_scores")
      .select("score_tier")
      .order("score_month", { ascending: false })
      .limit(100);
    
    if (!scores || scores.length === 0) return null;
    
    // Compter par tier pour trouver le dominant
    const tierCounts: Record<string, number> = {};
    scores.forEach(s => {
      if (s.score_tier) {
        tierCounts[s.score_tier] = (tierCounts[s.score_tier] || 0) + 1;
      }
    });
    
    const dominantTier = Object.entries(tierCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    
    return { dominantTier };
  },
});
```

#### 4. Modifier le header de la carte Uber Eats (lignes 964-975)
```typescript
<CardHeader className="pb-4">
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
    {successScoreData?.dominantTier && TIER_BADGE_CONFIG[successScoreData.dominantTier] && (
      <Badge 
        className={`${TIER_BADGE_CONFIG[successScoreData.dominantTier].color} text-white cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={() => navigate('/success-score')}
      >
        {TIER_BADGE_CONFIG[successScoreData.dominantTier].label}
      </Badge>
    )}
  </div>
</CardHeader>
```

---

## Résultat visuel attendu

```text
┌─────────────────────────────────────────┐
│ [🍔]  Uber Eats              [Correct] │
│       Semaine précédente                │
├─────────────────────────────────────────┤
│ ⭐ Note moyenne                   4.5/5 │
│ ⏱  Temps préparation            8 min  │
│ ...                                     │
└─────────────────────────────────────────┘
```

- Badge coloré selon le niveau dominant du réseau
- Cliquable : redirige vers `/success-score`

---

## Fichier modifié

| Fichier | Modifications |
|---------|---------------|
| `src/pages/Overview.tsx` | Import Badge + Config tiers + Query + Affichage badge |

