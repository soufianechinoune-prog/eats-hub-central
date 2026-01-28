

# Ajout d'un Historique Mensuel - Score de Réussite

## Objectif

Ajouter une section "Historique" en bas de la page `/success-score` qui affiche l'évolution des scores mois par mois, permettant de visualiser la progression du réseau et de chaque restaurant.

## Données disponibles

La base de données contient actuellement :
- Janvier 2026 (données les plus récentes)
- Décembre 2025

## Proposition de design

### Option A : Tableau d'historique compact (recommandé)

Une nouvelle Card en bas de page avec un tableau montrant :

| Mois | Score dominant | Excellence Op. | Notes | Menu | Emballage | CA total |
|------|----------------|----------------|-------|------|-----------|----------|
| Janvier 2026 | Correct (4) | 97.4% | 4.35 | 79% | 33% | 527 124 € |
| Décembre 2025 | Correct (4) | 97.2% | 4.28 | 75% | 100% | 489 000 € |

**Avantages :**
- Vue synthétique de l'évolution réseau
- Permet de comparer rapidement les mois
- Affiche les moyennes réseau par mois

### Option B : Tableau par restaurant (plus détaillé)

Un tableau expansible avec les lignes par mois, et pour chaque mois un sous-tableau des restaurants.

## Modifications techniques

### Fichier : `src/pages/SuccessScore.tsx`

1. **Nouveau useMemo `monthlyHistory`** : Grouper tous les scores par mois et calculer les agrégats (tier dominant, moyennes, CA total)

2. **Nouvelle section Card "Historique"** : Tableau avec les colonnes :
   - Mois (format "Janvier 2026")
   - Score dominant (badge du tier avec le plus de restaurants)
   - Excellence Op. moyenne
   - Notes moyenne
   - Détails Menu moyen
   - Emballage moyen
   - CA total réseau

3. **Import Calendar icon** : Pour l'en-tête de la section

### Structure du code

```tsx
// Nouveau useMemo pour l'historique
const monthlyHistory = useMemo(() => {
  if (!scores?.length) return [];
  
  // Grouper par score_month
  const byMonth = new Map<string, SuccessScore[]>();
  for (const score of scores) {
    const existing = byMonth.get(score.score_month) || [];
    existing.push(score);
    byMonth.set(score.score_month, existing);
  }
  
  // Calculer les stats pour chaque mois
  return Array.from(byMonth.entries())
    .sort((a, b) => b[0].localeCompare(a[0])) // Plus récent en premier
    .map(([month, monthScores]) => {
      // Calcul tier dominant, moyennes, CA total...
      return { month, tierCounts, avgOpEx, avgRatings, avgMenu, avgPackaging, totalSales };
    });
}, [scores]);
```

## Résultat attendu

Une nouvelle section en bas de page :

```text
┌────────────────────────────────────────────────────────────────────┐
│ 📅 Historique mensuel                                              │
├────────────────────────────────────────────────────────────────────┤
│ Mois           │ Score   │ Excel. │ Notes │ Menu │ Emb. │ CA      │
│────────────────│─────────│────────│───────│──────│──────│─────────│
│ Janvier 2026   │ Correct │ 97.4%  │ 4.35  │ 79%  │ 33%  │ 527k €  │
│ Décembre 2025  │ Correct │ 97.2%  │ 4.28  │ 75%  │ 100% │ 489k €  │
└────────────────────────────────────────────────────────────────────┘
```

## Fichier modifié

| Fichier | Modifications |
|---------|---------------|
| `src/pages/SuccessScore.tsx` | Import Calendar, nouveau useMemo `monthlyHistory`, nouvelle Card "Historique" en fin de page |

## Extensions possibles (futures)

- Cliquer sur un mois pour afficher le détail par restaurant de ce mois
- Graphique d'évolution des métriques (sparklines)
- Export PDF de l'historique

