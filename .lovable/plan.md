## Objectif

Retirer la vignette « Caisse » qui prend trop de place et affiche des KPIs non pertinents (`--` sur prépa, rentabilité, etc.). Garder l'information **CA Caisse** au bon endroit : dans la **Répartition du CA réseau**, qui est l'endroit naturel pour comparer les canaux.

## Ce qui change

### 1. Suppression de la vignette Caisse
- Retirer `<CashRevenueCard />` de `src/pages/Overview.tsx`.
- Repasser la grille de KPIs en **3 colonnes** (Global / Uber Eats / Deliveroo) — comme avant.
- Supprimer l'import du composant + import de `Store` si plus utilisé.
- Supprimer le fichier `src/components/overview/CashRevenueCard.tsx` (plus utilisé).
- **Garder** le hook `useNetworkCashRevenue` (utilisé par la barre de répartition).

### 2. Enrichir la barre « Répartition du CA réseau »
La barre garde déjà ses 3 segments (Uber / Deliveroo / Caisse) — c'est elle qui devient le seul point d'affichage du CA Caisse.

Ajouter sous la légende existante une **petite ligne discrète** (texte muted, taille xs) :

```
ⓘ Caisse Splash360 sur la période : 5 294 420 € — 31 jours de données — vs période précédente : -15.5%
```

Détails :
- N'apparaît que si `cashTotal > 0`.
- Affiche : montant Caisse, nombre de jours de données, variation vs période précédente (vert/rouge).
- Une seconde ligne, encore plus discrète, précise la source : `Source : Splash360 (réseau global). Détail par restaurant indisponible via l'API.`
- Le tout en `text-xs text-muted-foreground` avec une bordure haute fine `border-t border-border/40 pt-2` pour séparer de la légende, sans casser l'esthétique de la card.

Pour cela :
- Étendre les props de `PlatformRevenueSplit` :
  - `cashDaysWithData?: number`
  - `cashVariation?: number | null`
- Les passer depuis `Overview.tsx` à partir de `cashRevenueData`.

### 3. Tableau comparatif (bas de page)
Aucun changement par rapport à l'état actuel : la colonne « CAISSE » reste affichée au niveau réseau global (avec `--` par restaurant), c'est ce que tu avais validé.

## Fichiers touchés

- `src/pages/Overview.tsx` — retirer la card, repasser en 3 colonnes, passer les props enrichies à `PlatformRevenueSplit`.
- `src/components/overview/PlatformRevenueSplit.tsx` — ajouter la ligne info Caisse sous la légende.
- `src/components/overview/CashRevenueCard.tsx` — supprimer.

## Ce qui ne change pas

- Hook `useNetworkCashRevenue.ts` (toujours utilisé).
- Tokens couleur `--cash` dans `index.css` / `tailwind.config.ts` (utilisés par la barre + tableau).
- Modifications de `RestaurantComparisonTable.tsx` (colonne CAISSE conservée).
- Logique de calcul Caisse = global − uber − deliveroo, scopée Chicken Street.

## Résultat visuel attendu

```text
┌─────────────────────────────────────────────────────────────────┐
│ Global         │ Uber Eats       │ Deliveroo                    │
│ (vignette)     │ (vignette)      │ (vignette)                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Répartition du CA réseau              Total : 6 052 721 €       │
│                                                                  │
│ [████ Uber 9.4% ████ Deliv 3.1% ███████ Caisse 87.5% ████████] │
│                                                                  │
│ 🟢 Uber Eats 571 365 €   🔵 Deliveroo 186 936 €   🟣 Caisse 5 294 420 € │
│ ───────────────────────────────────────────────────────────────  │
│ ⓘ Caisse Splash360 : 31j de données · vs période préc. -15.5%   │
│   Source : réseau global · détail par restaurant indisponible   │
└─────────────────────────────────────────────────────────────────┘
```

Discret, contextuel, et la grille KPIs retrouve ses respirations.