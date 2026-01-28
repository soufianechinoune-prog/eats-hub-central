
# Mise à jour de l'affichage Emballage Durable - Success Score

## Contexte

Actuellement, la page Success Score affiche :
- **KPI "Emballages Durables"** : "Non applicable en France" alors que les données existent dans la base (100%, 33%, etc.)
- **Tableau "Détail par Restaurant"** : colonne "Prochain objectif" peu utile

## Modifications à effectuer

### 1. Mise à jour du KPI "Emballages Durables" (lignes 451-464)

Remplacer l'affichage statique par les données réelles calculées depuis la base.

**Avant :**
```tsx
<p className="text-2xl font-bold text-muted-foreground">—</p>
<p className="text-xs text-muted-foreground">Non applicable en France</p>
```

**Après :**
```tsx
<p className="text-2xl font-bold">
  {networkStats.avgSustainablePackaging != null 
    ? `${networkStats.avgSustainablePackaging.toFixed(0)}%` 
    : '—'}
</p>
<p className="text-xs text-muted-foreground">Objectif Excellent: 90%</p>
```

### 2. Calcul de la moyenne Emballage (networkStats - lignes 176-210)

Ajouter le calcul de la moyenne `avgSustainablePackaging` dans le `useMemo` de `networkStats` :

```tsx
let totalSustainablePackaging = 0;
let sustainablePackagingCount = 0;

// Dans la boucle for
if (score.sustainable_packaging != null) {
  totalSustainablePackaging += score.sustainable_packaging;
  sustainablePackagingCount++;
}

// Dans le return
avgSustainablePackaging: sustainablePackagingCount > 0 
  ? totalSustainablePackaging / sustainablePackagingCount 
  : null,
```

### 3. Tableau : Remplacer "Prochain objectif" par "Emballage"

**Header (ligne 498)** :
```tsx
// Avant
<TableHead>Prochain objectif</TableHead>

// Après  
<TableHead className="text-center">Emballage</TableHead>
```

**Cellule (lignes 537-570)** :
```tsx
// Avant : logique complexe de "Prochain objectif"

// Après : Affichage simple de sustainable_packaging
<TableCell className="text-center">
  <span className={score.sustainable_packaging != null && score.sustainable_packaging >= 90 
    ? 'text-green-600 font-semibold' 
    : 'text-muted-foreground'}>
    {score.sustainable_packaging != null 
      ? `${score.sustainable_packaging.toFixed(0)}%` 
      : '—'}
  </span>
</TableCell>
```

## Fichier modifié

| Fichier | Modifications |
|---------|---------------|
| `src/pages/SuccessScore.tsx` | Calcul avgSustainablePackaging, KPI dynamique, colonne Emballage |

## Résultat attendu

| Élément | Avant | Après |
|---------|-------|-------|
| KPI Emballages Durables | "—" + "Non applicable en France" | "92%" + "Objectif Excellent: 90%" |
| Colonne tableau | Prochain objectif (complexe) | Emballage (100%, 33%, etc.) |

## Détails techniques

La fonction `getProgressToNextTier` (lignes 214-269) est conservée mais n'est plus utilisée dans le tableau. Elle pourrait être réutilisée ailleurs (tooltip, détail restaurant) si nécessaire.
