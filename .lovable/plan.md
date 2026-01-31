
# Modification des sources de données et des libellés pour les temps de préparation

## Résumé de la demande

L'utilisateur veut :
1. **Dans les rapports WhatsApp** : Le KPI "Temps prep" (actuellement 9 min dans la capture) doit utiliser les données de "Prépa+Livraison" (`total_prep_delivery_time_minutes`) au lieu du temps de prépa initial (`initial_prep_time_minutes`). Le label reste "Temps prep" ou "Temps de préparation"
2. **Dans les onglets Opérations** : Renommer les 3 onglets de temps :
   - "Temps de prépa" → "Temps de prépa initial"
   - "Temps d'attente" → "Temps d'attente du coursier (restaurant)"
   - "Prépa+Livraison" → "Temps de prépa total"

---

## Partie 1 : Modification des edge functions pour les rapports WhatsApp

### 1.1 Fichier `supabase/functions/generate-weekly-report/index.ts`

**Modification de la requête order_history** (lignes 117-132) :
- Ajouter `total_prep_delivery_time_minutes` à la sélection
- Utiliser ce champ pour `avg_prep_time` au lieu de `initial_prep_time_minutes`

```typescript
// Avant (lignes 117-127)
const { data: orderHistory } = await supabase
  .from('order_history')
  .select('initial_prep_time_minutes, avoidable_wait_time_minutes')
  ...

// Après
const { data: orderHistory } = await supabase
  .from('order_history')
  .select('total_prep_delivery_time_minutes, avoidable_wait_time_minutes')
  ...

// Calcul (lignes 124-127)
// Avant
const validPrepTimes = orderHistory?.filter(o => o.initial_prep_time_minutes !== null) || [];
const avgPrepTime = validPrepTimes.length > 0
  ? validPrepTimes.reduce((sum, o) => sum + (o.initial_prep_time_minutes || 0), 0) / validPrepTimes.length
  : null;

// Après
const validPrepTimes = orderHistory?.filter(o => o.total_prep_delivery_time_minutes !== null) || [];
const avgPrepTime = validPrepTimes.length > 0
  ? validPrepTimes.reduce((sum, o) => sum + (o.total_prep_delivery_time_minutes || 0), 0) / validPrepTimes.length
  : null;
```

### 1.2 Fichier `supabase/functions/generate-ai-report/index.ts`

**Même modification** (lignes 186-197) :
- Remplacer `initial_prep_time_minutes` par `total_prep_delivery_time_minutes`

---

## Partie 2 : Renommage des onglets Opérations

### 2.1 Fichier `src/components/analytics/OperationsAnalytics.tsx`

**Modification des TabsTrigger** (lignes 563-586) :

| Onglet | Value | Avant | Après (complet) | Après (mobile) |
|--------|-------|-------|-----------------|----------------|
| prepTime | Temps de prépa | Temps de prépa initial | Prépa initial |
| waitTime | Temps d'attente | Temps d'attente du coursier (restaurant) | Attente coursier |
| totalDelivery | Prépa+Livraison | Temps de prépa total | Prépa total |

---

## Fichiers à modifier

| Fichier | Modification |
|---------|--------------|
| `supabase/functions/generate-weekly-report/index.ts` | Query + calcul `total_prep_delivery_time_minutes` |
| `supabase/functions/generate-ai-report/index.ts` | Query + calcul `total_prep_delivery_time_minutes` |
| `src/components/analytics/OperationsAnalytics.tsx` | Renommage des 3 onglets |

---

## Résultat attendu

1. **Rapports WhatsApp** : Le "Temps prep" affichera le temps total (prépa + livraison), typiquement ~15 min au lieu de ~9 min
2. **Onglets Opérations** :
   - "Temps de prépa initial" → analyse du temps de préparation en cuisine
   - "Temps d'attente du coursier (restaurant)" → temps d'attente évitable
   - "Temps de prépa total" → temps de bout en bout (commande à livraison)
