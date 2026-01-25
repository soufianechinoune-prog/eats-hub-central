
# Plan de correction : Tooltips invisibles et formulaire de saisie manuelle

## Problèmes identifiés

Après analyse du code, j'ai identifié les problèmes suivants :

### 1. **Tooltips non fonctionnels**

**Cause** : Dans `src/pages/SuccessScore.tsx`, les `TooltipTrigger` n'utilisent pas la prop `asChild`. Sans cette prop, le TooltipTrigger crée un élément wrapper qui peut bloquer les événements de survol.

**Localisation** :
- Lignes 373-381 : Badges de tier dans la distribution réseau
- Lignes 513-522 : Metric "Excellence Opérationnelle" dans le tableau

**Code actuel (problématique)** :
```typescript
<Tooltip>
  <TooltipTrigger>
    <Badge className={`${config.color} text-white cursor-help`}>{config.label}</Badge>
  </TooltipTrigger>
  <TooltipContent>...</TooltipContent>
</Tooltip>
```

**Solution** : Ajouter `asChild` au TooltipTrigger :
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Badge className={`${config.color} text-white cursor-help`}>{config.label}</Badge>
  </TooltipTrigger>
  <TooltipContent>...</TooltipContent>
</Tooltip>
```

### 2. **Formulaire de saisie manuelle**

Le formulaire **est déjà implémenté** dans `src/components/success-score/ManualEntryDialog.tsx` et le bouton est bien présent sur la page Success Score.

**Fonctionnement attendu** :
1. Cliquer sur le bouton "Saisie manuelle" (avec icône crayon) en haut à droite de la page
2. Un dialog s'ouvre avec le formulaire
3. L'utilisateur peut :
   - Sélectionner le mois concerné
   - Choisir le restaurant
   - Saisir le niveau (Excellent, Très Bon, Bon, Correct, Insuffisant)
   - Entrer les métriques : Excellence Op., Détails Menu, Note, Emballages, CA
4. Boutons d'action :
   - "Enregistrer" : sauvegarde et ferme
   - "Enregistrer et suivant" : sauvegarde et passe au restaurant suivant

**Champs disponibles dans le formulaire** :
- **Mois concerné** : sélecteur de mois
- **Restaurant** : dropdown avec liste des restaurants
- **Niveau** : dropdown (Excellent, Très Bon, Bon, Correct, Insuffisant)
- **Excellence Op. (%)** : nombre 0-100, step 0.1
- **Détails Menu (%)** : nombre 0-100
- **Note (/5)** : nombre 0-5, step 0.01
- **Emballages (%)** : nombre 0-100
- **CA mensuel (€)** : nombre

---

## Modifications à apporter

### Fichier : `src/pages/SuccessScore.tsx`

#### 1. Corriger les tooltips des badges de tier (lignes 373-381)

**Avant** :
```typescript
<Tooltip>
  <TooltipTrigger>
    <Badge className={`${config.color} text-white cursor-help`}>{config.label}</Badge>
  </TooltipTrigger>
  <TooltipContent side="bottom" className="max-w-xs p-3">
    <p className="font-semibold mb-1">{config.label}</p>
    <p className="text-sm text-muted-foreground">{config.description}</p>
  </TooltipContent>
</Tooltip>
```

**Après** :
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <span className="cursor-help">
      <Badge className={`${config.color} text-white`}>{config.label}</Badge>
    </span>
  </TooltipTrigger>
  <TooltipContent side="bottom" className="max-w-xs p-3">
    <p className="font-semibold mb-1">{config.label}</p>
    <p className="text-sm text-muted-foreground">{config.description}</p>
  </TooltipContent>
</Tooltip>
```

**Note** : On enveloppe le Badge dans un `<span>` car les Badges sont des `<div>` et les tooltips fonctionnent mieux avec des éléments inline ou interactifs.

#### 2. Corriger le tooltip de l'Excellence Opérationnelle (lignes 513-522)

**Avant** :
```typescript
<Tooltip>
  <TooltipTrigger>
    <span className={...}>
      {score.operational_excellence != null ? ... : 'Non renseigné'}
    </span>
  </TooltipTrigger>
  <TooltipContent>
    <p>Objectif "Bon": ≥ 98.4%</p>
  </TooltipContent>
</Tooltip>
```

**Après** :
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <span className={`${score.operational_excellence != null && score.operational_excellence >= 98.4 ? 'text-green-600 font-semibold' : 'text-orange-600'} cursor-help`}>
      {score.operational_excellence != null ? `${score.operational_excellence.toFixed(1)}%` : 'Non renseigné'}
    </span>
  </TooltipTrigger>
  <TooltipContent>
    <p>Objectif "Bon": ≥ 98.4%</p>
  </TooltipContent>
</Tooltip>
```

#### 3. Améliorer la visibilité du bouton "Saisie manuelle"

Le bouton est déjà présent, mais pour le rendre plus visible, on peut :
- Ajouter une couleur de fond (variant="default" au lieu de "outline")
- Ou garder le outline mais avec une bordure plus visible

**Option recommandée** : Mettre le bouton "Saisie manuelle" en variant="default" pour qu'il soit plus visible :

```typescript
{/* Ligne 298 - ManualEntryDialog rend déjà le bouton */}
```

**Dans ManualEntryDialog.tsx** (ligne 160), modifier :
```typescript
<DialogTrigger asChild>
  <Button variant="default" className="gap-2">  {/* Changé de "outline" à "default" */}
    <Pencil className="h-4 w-4" />
    Saisie manuelle
  </Button>
</DialogTrigger>
```

---

## Workflow pour l'utilisateur après corrections

### Pour utiliser les tooltips :
1. Survoler les badges colorés (Excellent, Très Bon, etc.) dans la section "Réseau"
2. Un tooltip apparaît avec la description du niveau et les avantages
3. Survoler "Excellence Op." dans le tableau pour voir l'objectif

### Pour la saisie manuelle :
1. Cliquer sur le bouton **"Saisie manuelle"** en haut à droite (à côté de "Importer CSV")
2. Le dialog s'ouvre
3. Remplir le formulaire :
   - Sélectionner le mois
   - Choisir le restaurant
   - Entrer le niveau (Status)
   - Saisir les métriques depuis les screenshots Uber Eats
4. Cliquer sur "Enregistrer et suivant" pour passer au restaurant suivant, ou "Enregistrer" pour fermer

---

## Résumé des fichiers à modifier

| Fichier | Modifications |
|---------|---------------|
| `src/pages/SuccessScore.tsx` | Ajouter `asChild` aux TooltipTrigger (2 endroits) + wrapper span pour badges |
| `src/components/success-score/ManualEntryDialog.tsx` | Changer variant du bouton de "outline" à "default" pour plus de visibilité |

---

## Tests à effectuer après les modifications

1. **Tooltips** :
   - Survoler les badges de tier → tooltip doit apparaître instantanément
   - Survoler "Excellence Op." dans le tableau → tooltip avec objectif

2. **Formulaire** :
   - Cliquer sur "Saisie manuelle" → dialog s'ouvre
   - Sélectionner un restaurant → les données existantes se chargent si disponibles
   - Saisir/modifier les valeurs → enregistrement fonctionne
   - "Enregistrer et suivant" → passe au restaurant suivant
