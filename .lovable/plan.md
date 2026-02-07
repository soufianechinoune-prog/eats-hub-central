

# Plan : Afficher tous les restaurants même sans données de disponibilité

## Problème identifié

La logique actuelle dans `DowntimeComparison.tsx` ligne 127 exclut **tous** les restaurants si `availabilityData` est vide :

```typescript
if (!availabilityData?.length || !selectedRestaurants?.length) return [];
```

Résultat : seuls les 6 restaurants ayant des entrées dans la table `hourly_availability` apparaissent.

## Solution

Modifier la condition pour n'exiger que la présence de `selectedRestaurants`. Les restaurants sans données de disponibilité seront considérés comme "100% disponibles" (aucune interruption enregistrée).

---

## Fichier à modifier

**`src/pages/DowntimeComparison.tsx`**

---

## Modification

### Ligne 127 : Supprimer la condition sur `availabilityData`

**Avant :**
```typescript
if (!availabilityData?.length || !selectedRestaurants?.length) return [];
```

**Après :**
```typescript
if (!selectedRestaurants?.length) return [];
```

---

## Comportement attendu

| Cas | Avant | Après |
|-----|-------|-------|
| Restaurant avec données | Affiché avec stats calculées | Inchangé |
| Restaurant sans données | Non affiché | Affiché à 100% disponibilité, 0min hors ligne |
| Tous sans données | Liste vide | Tous à 100% |

Les 100 restaurants du réseau seront tous visibles, avec les données réelles pour ceux qui en ont, et 100% de disponibilité pour les autres (logique métier : pas de rapport d'indisponibilité = tout va bien).

