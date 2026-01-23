
# Optimiser l'affichage de l'analyse Uber One

## Problèmes identifiés

1. **"Comparaison par restaurant"** : Quand un seul restaurant est affiché, cette section montre une seule barre horizontale sans aucun comparatif — c'est inutile
2. **"Temps de prépa"** : Dans la table "Comportement comparé", cette métrique n'apporte pas de valeur ajoutée pertinente pour analyser les clients Uber One

## Solution proposée

### 1. Masquer "Comparaison par restaurant" en vue mono-restaurant

Ajouter une condition pour ne pas afficher cette Card quand `byRestaurant.length === 1`

**Fichier** : `src/components/analytics/UberOneAnalysis.tsx`

**Comportement** :
- Si 1 restaurant sélectionné → la section "Comparaison par restaurant" est masquée
- Si 2+ restaurants sélectionnés → la section s'affiche normalement

**Impact sur le layout** :
- En vue mono-restaurant, la table "Comportement comparé" passe en pleine largeur (`lg:col-span-2`) pour occuper l'espace libéré

### 2. Retirer "Temps de prépa" du tableau "Comportement comparé"

Supprimer cette ligne du tableau de comparaison Uber One vs Standard

**Fichier** : `src/hooks/useUberOneStats.ts`

**Métriques conservées** :
- ✅ Panier moyen (€)
- ✅ Volume (nombre de commandes)
- ❌ Temps de prépa (retiré)

---

## Changements techniques

### `src/components/analytics/UberOneAnalysis.tsx`

**Ligne ~420** — Ajouter une condition sur la section :

```typescript
// Afficher uniquement si plus d'un restaurant
{byRestaurant.length > 1 && (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-lg">Comparaison par restaurant</CardTitle>
    </CardHeader>
    {/* ... contenu existant ... */}
  </Card>
)}

{/* Adapter la largeur de "Comportement comparé" */}
<Card className={byRestaurant.length > 1 ? "" : "lg:col-span-2"}>
  {/* ... Comportement comparé ... */}
</Card>
```

### `src/hooks/useUberOneStats.ts`

**Lignes 349-372** — Supprimer le bloc "Temps de prépa" :

```typescript
// Avant (3 métriques)
return [
  { metric: "Panier moyen", ... },
  { metric: "Temps de prépa", ... },  // ← Supprimer
  { metric: "Volume", ... },
];

// Après (2 métriques)
return [
  { metric: "Panier moyen", ... },
  { metric: "Volume", ... },
];
```

---

## Résultat attendu

| Sélection | Avant | Après |
|-----------|-------|-------|
| 1 restaurant | Bar chart avec 1 barre + table 3 lignes | Pas de bar chart, table pleine largeur 2 lignes |
| 2+ restaurants | Bar chart comparatif + table 3 lignes | Bar chart comparatif + table 2 lignes |

---

## Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `src/components/analytics/UberOneAnalysis.tsx` | Condition d'affichage sur "Comparaison par restaurant", layout adaptatif |
| `src/hooks/useUberOneStats.ts` | Retrait de la métrique "Temps de prépa" |
