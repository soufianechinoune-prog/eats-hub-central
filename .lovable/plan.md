
# Corriger le problème de timezone dans l'évolution Uber One

## Diagnostic

Le graphique "Évolution % Uber One" utilise des dates UTC alors que les autres graphiques du projet utilisent le fuseau horaire "Europe/Paris". Cela cause :

1. **Décalage des jours** : Les commandes de fin de soirée (22h-00h heure Paris) sont attribuées au jour suivant en UTC
2. **Pics artificiels** : Le 1er d'un mois en UTC peut accumuler des commandes de la veille (en heure Paris)
3. **Disparition des pics** : Quand la plage s'élargit, la distribution change car les commandes sont réattribuées différemment

### Exemple concret

Une commande passée le **31 octobre à 23h30 (Paris)** :
- En UTC : `2025-11-01 00:30:00+00`
- Le code actuel l'attribue au **1er novembre** (clé `2025-11-01`)
- Elle devrait être attribuée au **31 octobre** (jour ouvré Paris)

## Solution

Aligner le calcul des dates sur le fuseau "Europe/Paris", comme les autres graphiques du projet.

### Fichier à modifier : `src/hooks/useUberOneStats.ts`

**1. Ajouter une fonction utilitaire pour formater en heure Paris**

```typescript
// Formater une date en YYYY-MM-DD selon le fuseau Europe/Paris
const formatDateParis = (date: Date): string => {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

// Formater une date en YYYY-MM selon le fuseau Europe/Paris
const formatMonthParis = (date: Date): string => {
  const formatted = formatDateParis(date);
  return formatted.slice(0, 7); // YYYY-MM
};
```

**2. Modifier le calcul de `evolution` (lignes 172-211)**

Remplacer :
```typescript
const date = new Date(order.order_datetime);
const key = useDaily 
  ? date.toISOString().split('T')[0]  // YYYY-MM-DD
  : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
```

Par :
```typescript
const date = new Date(order.order_datetime);
const key = useDaily 
  ? formatDateParis(date)  // YYYY-MM-DD en heure Paris
  : formatMonthParis(date);  // YYYY-MM en heure Paris
```

**3. Modifier la génération des labels (lignes 193-199)**

Remplacer :
```typescript
if (useDaily) {
  const d = new Date(key);
  label = `${d.getDate()} ${monthLabels[d.getMonth()].toLowerCase()}`;
}
```

Par :
```typescript
if (useDaily) {
  // Ajouter T12:00:00 pour éviter les décalages de timezone lors du parsing
  const d = new Date(key + "T12:00:00");
  label = `${d.getDate()} ${monthLabels[d.getMonth()].toLowerCase()}`;
}
```

**4. Appliquer les mêmes corrections à `evolutionByRestaurant` (lignes 223-268)**

Même logique : utiliser `formatDateParis` et `formatMonthParis` pour les clés, et corriger le parsing pour les labels.

---

## Résultat attendu

| Avant | Après |
|-------|-------|
| Commande 31 oct 23h30 → Clé "2025-11-01" | Commande 31 oct 23h30 → Clé "2025-10-31" |
| Pic artificiel le 1er du mois | Distribution réaliste |
| Données incohérentes selon la plage | Données identiques quelle que soit la plage |

---

## Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `src/hooks/useUberOneStats.ts` | Utiliser le fuseau Europe/Paris pour le groupement des dates |

---

## Section technique

### Pourquoi `Intl.DateTimeFormat` avec `fr-CA` ?

- `fr-CA` retourne le format `YYYY-MM-DD` directement (ISO-compatible)
- Combiné avec `timeZone: 'Europe/Paris'`, cela garantit le bon jour ouvré français

### Pourquoi `T12:00:00` lors du parsing ?

- `new Date("2025-11-01")` est interprété comme minuit UTC
- En France (UTC+1), cela devient le 31 octobre à 23h
- En ajoutant `T12:00:00`, on force midi local, évitant tout décalage de jour

### Cohérence avec le projet

Cette approche est déjà utilisée dans :
- `useFinancesDrilldown` pour les groupements journaliers
- Les graphiques de rentabilité
- Toute la section "Revenus & Ventes"
