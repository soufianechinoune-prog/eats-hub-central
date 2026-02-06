

# Plan : Vue Tableau Complet + Export PDF Notes Réseau

## Constat

Actuellement la page `/compare/ratings` affiche :
- Top 10 + Bottom 5 dans les barres de ranking
- Heatmap limité à 25 restaurants visibles (avec modal paginée)
- **Aucun tableau synthétique** avec TOUS les restaurants
- **Aucun bouton d'export PDF**

## Solution proposée

### 1. Nouveau composant : Tableau complet triable

Un tableau simple et lisible affichant TOUS les restaurants avec :

| # | Restaurant | Note | Avis | Statut |
|---|------------|------|------|--------|
| 1 | Douai | 5.00 | 10 | Excellent |
| 2 | Toulouse | 4.89 | 9 | Excellent |
| ... | ... | ... | ... | ... |
| 92 | Juvisy | 1.00 | 1 | Attention |

Fonctionnalités :
- Tri par colonne (Note, Avis, Nom)
- Recherche rapide par nom
- Pagination (25 par page) ou scroll virtuel
- Badges de statut colorés (Excellent/Tres bien/Bon/A surveiller)

### 2. Export PDF professionnel

Rapport multi-pages style "executive report" :

**Page 1 - Couverture**
- Logo Chicken Street
- Titre "Rapport Notes Réseau"
- Période et date de génération
- KPIs globaux (Note moyenne, Total avis, Uber/Deliveroo)

**Page 2 - Synthèse visuelle**
- Distribution des notes (graphique barres)
- Top 5 / Flop 5 (tableau synthétique)
- Insights textuels

**Pages 3+ - Tableau détaillé**
- Liste complète des 92 restaurants
- ~30 restaurants par page
- Code couleur par performance
- Totaux en pied de page

### 3. Intégration dans la page

Ajouter entre le Heatmap et les Tags :

```text
+-- Classement complet ----------------------------------+
|  [🔍 Rechercher...]           [Trier: Note ▼] [PDF 📄] |
|                                                        |
|  #   Restaurant              Note      Avis   Statut   |
|  1   Douai                   ⭐ 5.00   10     Excellent |
|  2   Toulouse                ⭐ 4.89   9      Excellent |
|  3   Venissieux              ⭐ 4.88   24     Excellent |
|  ...                                                   |
|                                                        |
|  < Page 1 / 4 >                                        |
+--------------------------------------------------------+
```

## Fichiers à créer/modifier

| Action | Fichier | Description |
|--------|---------|-------------|
| Créer | `src/components/compare/RatingsFullRankingTable.tsx` | Tableau complet avec tri/recherche/pagination |
| Créer | `src/hooks/useRatingsExport.ts` | Hook d'export PDF multi-pages |
| Modifier | `src/pages/RatingsComparison.tsx` | Intégrer tableau + bouton export |

## Section technique

### Structure du hook d'export

```typescript
interface RatingsExportData {
  period: string;
  periodLabel: string;
  globalStats: {
    avgRating: number;
    totalReviews: number;
    uberAvg: number;
    deliverooAvg: number;
  };
  distribution: { star: string; count: number }[];
  restaurants: {
    rank: number;
    name: string;
    avgRating: number;
    totalReviews: number;
    status: string;
  }[];
}
```

Le PDF utilisera jsPDF avec :
- Format A4 portrait (meilleur pour les tableaux longs)
- En-tête fixe avec logo sur chaque page
- Pagination automatique (~30 lignes/page)
- Couleurs cohérentes avec la charte (emerald pour succès, orange pour attention)

### Structure du tableau

Le composant réutilisera les patterns existants :
- `<Table>` de shadcn/ui pour la structure
- Tri via `useState` + `.sort()`
- Pagination avec le composant `<Pagination>` existant
- Recherche avec `useMemo` filtrant sur le nom

