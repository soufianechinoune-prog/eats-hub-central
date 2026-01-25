

# Plan : Remplacer tous les "N/A" restants

## Problème
Les cartes KPI du réseau affichent encore "N/A" au lieu d'un texte plus clair en français.

---

## Modifications

### Fichier : `src/pages/SuccessScore.tsx`

#### 1. Excellence Opérationnelle (ligne 384)
```typescript
// Avant
{networkStats.avgOperationalExcellence?.toFixed(1) || 'N/A'}%

// Après
{networkStats.avgOperationalExcellence != null 
  ? `${networkStats.avgOperationalExcellence.toFixed(1)}%` 
  : '—'}
```

#### 2. Notes Clients (ligne 401)
```typescript
// Avant
{networkStats.avgRatings?.toFixed(2) || 'N/A'}

// Après
{networkStats.avgRatings?.toFixed(2) || '—'}
```

#### 3. Détails Menu (ligne 418)
```typescript
// Avant
{networkStats.avgMenuDetails?.toFixed(0) || 'N/A'}%

// Après
{networkStats.avgMenuDetails != null 
  ? `${networkStats.avgMenuDetails.toFixed(0)}%` 
  : '—'}
```

#### 4. Emballages Durables (ligne 434)
```typescript
// Avant
<p className="text-2xl font-bold">N/A</p>
<p className="text-xs text-muted-foreground">Non applicable en France</p>

// Après
<p className="text-2xl font-bold text-muted-foreground">—</p>
<p className="text-xs text-muted-foreground">Non applicable en France</p>
```

---

## Légende des remplacements

| Ancien | Nouveau | Signification |
|--------|---------|---------------|
| `N/A` | `—` | Donnée non disponible ou non applicable |
| `N/A%` | `—` | Évite l'affichage confus "N/A%" |

Le tiret `—` est plus visuel et ne nécessite pas de traduction.

---

## Fichier modifié

| Fichier | Lignes |
|---------|--------|
| `src/pages/SuccessScore.tsx` | 384, 401, 418, 434 |

