
# Plan : Corriger l'affichage du Score de Réussite

## Problèmes à résoudre

1. **"Tous les objectifs atteints!" affiché à tort** - La logique actuelle ne prend pas en compte que les métriques sont `null`
2. **Colonnes manquantes dans le tableau** - Il manque le CA (Sales) qui est dans le CSV
3. **"N/A" pas explicite** - Remplacer par un texte plus clair

---

## Modifications

### Fichier : `src/pages/SuccessScore.tsx`

#### 1. Corriger la logique de progression

Actuellement, si une métrique est `null`, elle n'est pas ajoutée aux gaps, donc le tableau gaps reste vide, ce qui affiche "Tous les objectifs atteints!".

**Nouvelle logique** :
- Si les métriques du prochain niveau sont requises mais que la valeur actuelle est `null`, afficher "Données manquantes"
- Si toutes les métriques connues sont OK mais le restaurant est encore Fair, afficher "Selon critères Uber"

```typescript
const getProgressToNextTier = (score: SuccessScore) => {
  // ... existing code ...
  
  const gaps: { metric: string; current: number | null; target: number; gap: number }[] = [];
  const missingMetrics: string[] = [];
  
  // Check operational excellence
  if (objectives.operationalExcellence) {
    if (score.operational_excellence != null) {
      const gap = objectives.operationalExcellence - score.operational_excellence;
      gaps.push({ metric: 'Excellence Op.', current: score.operational_excellence, target: objectives.operationalExcellence, gap });
    } else {
      missingMetrics.push('Excellence Op.');
    }
  }
  
  // Similar for ratings, menuDetails...
  
  return { nextTier, gaps, missingMetrics };
};
```

#### 2. Mettre à jour le rendu de "Prochain objectif"

```typescript
{progress ? (
  <div className="space-y-1">
    <span className="text-xs text-muted-foreground">
      Pour atteindre {TIER_CONFIG[progress.nextTier]?.label}:
    </span>
    
    {/* Afficher les gaps positifs (objectifs non atteints) */}
    {progress.gaps.filter(g => g.gap > 0).slice(0, 2).map((gap, i) => (
      <div key={i} className="text-xs flex items-center gap-1">
        <AlertTriangle className="h-3 w-3 text-orange-500" />
        <span>{gap.metric}: +{gap.gap.toFixed(1)}%</span>
      </div>
    ))}
    
    {/* Afficher les métriques manquantes */}
    {progress.missingMetrics.length > 0 && (
      <div className="text-xs flex items-center gap-1 text-muted-foreground">
        <Info className="h-3 w-3" />
        <span>Non renseigné: {progress.missingMetrics.join(', ')}</span>
      </div>
    )}
    
    {/* Si tous les gaps sont atteints mais métriques manquantes */}
    {progress.gaps.filter(g => g.gap > 0).length === 0 && progress.missingMetrics.length === 0 && (
      <div className="text-xs flex items-center gap-1 text-amber-600">
        <Info className="h-3 w-3" />
        <span>Critères Uber non détaillés</span>
      </div>
    )}
  </div>
) : (
  <div className="text-xs flex items-center gap-1 text-emerald-600">
    <CheckCircle className="h-3 w-3" />
    <span>Niveau maximum</span>
  </div>
)}
```

#### 3. Remplacer "N/A" par "Non renseigné"

Dans les cellules du tableau :

```typescript
// Excellence Op.
{score.operational_excellence?.toFixed(1) || '—'}%

// Notes
{score.ratings?.toFixed(2) || 'Non renseigné'}

// Détails Menu
{score.menu_details != null ? `${score.menu_details.toFixed(0)}%` : 'Non renseigné'}
```

#### 4. Ajouter la colonne CA (Sales)

Ajouter une colonne "CA" après "Détails Menu" pour afficher le chiffre d'affaires du mois :

```typescript
<TableHead className="text-center">CA</TableHead>

// Dans le body
<TableCell className="text-center">
  {score.sales_amount != null 
    ? `${score.sales_amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`
    : 'Non renseigné'}
</TableCell>
```

---

## Résultat attendu

| Restaurant | Score | Excellence Op. | Notes | Détails Menu | CA | Prochain objectif |
|------------|-------|----------------|-------|--------------|-----|-------------------|
| Chicken Street Juvisy | Correct | 97.0% | Non renseigné | Non renseigné | 119 045 € | Pour atteindre Bon: ✓ Excellence Op. atteinte, ⚠ Notes: Non renseigné |

---

## Récapitulatif des fichiers

| Fichier | Modification |
|---------|--------------|
| `src/pages/SuccessScore.tsx` | Corriger logique progression + ajouter colonne CA + remplacer "N/A" |
