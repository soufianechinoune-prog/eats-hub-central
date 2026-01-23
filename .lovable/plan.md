

# Modifier les KPIs et le slider "Temps Prépa+Livraison"

## Changements demandés

1. **Slider objectif** : Permettre de descendre en dessous de 20 min (actuellement le minimum est 20 min)
2. **Carte "Amplitude"** : La remplacer par le nombre de commandes qui respectent l'objectif

## Modifications techniques

### Fichier `src/components/analytics/TotalDeliveryTimeAnalytics.tsx`

#### 1. Modifier le slider (ligne 560)

Réduire la valeur minimum de 20 à 10 minutes et le pas à 1 minute pour plus de précision :

```typescript
// Avant
min={20}
max={60}
step={5}

// Après
min={10}
max={60}
step={1}
```

#### 2. Remplacer la carte "Amplitude" (lignes 496-511)

Remplacer par une carte qui affiche le nombre de commandes qui respectent l'objectif :

```typescript
// Avant
<Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
  <CardHeader>
    <CardTitle>Amplitude</CardTitle>
    <TrendingDown />
  </CardHeader>
  <CardContent>
    <div>{formatMinutes(kpis.minTime)} - {formatMinutes(kpis.maxTime)}</div>
    <p>Min - Max sur la période</p>
  </CardContent>
</Card>

// Après
<Card className="bg-card/80 backdrop-blur-xl border-2 shadow-xl">
  <CardHeader>
    <CardTitle>Commandes conformes</CardTitle>
    <Target />  {/* Icône objectif */}
  </CardHeader>
  <CardContent>
    <div className="text-chart-2">  {/* Valeur absolue */}
      {kpis.ordersUnderTarget.toLocaleString('fr-FR')}
    </div>
    <p>≤ {targetMinutes} min sur {kpis.totalOrders.toLocaleString('fr-FR')}</p>
  </CardContent>
</Card>
```

## Résultat

| Carte | Avant | Après |
|-------|-------|-------|
| 1 | Temps moyen prépa+livraison | *(inchangé)* |
| 2 | Commandes analysées | *(inchangé)* |
| 3 | Objectif atteint (%) | *(inchangé)* - affiche le pourcentage |
| 4 | Amplitude (Min - Max) | **Commandes conformes** - affiche le nombre absolu |

| Slider | Avant | Après |
|--------|-------|-------|
| Min | 20 min | 10 min |
| Max | 60 min | *(inchangé)* |
| Pas | 5 min | 1 min |

## Fichier modifié

| Fichier | Modification |
|---------|--------------|
| `src/components/analytics/TotalDeliveryTimeAnalytics.tsx` | Slider min 10, step 1 + carte "Commandes conformes" |

